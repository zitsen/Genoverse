/*!
 * Copyright (c) 2011 Genome Research Ltd.
 * Authosr: Evgeny Bragin, Simon Brent
 * Released under the Modified-BSD license, see LICENSE.TXT
 */


var CBrowse = Base.extend({
  defaults: {
    image: new Image(),
    width: 1000,
    chromosome: chromosomes["1"],
    zoom: 1,
    start: 0,
    delta: 0,
    colors: {
      foreground: '#000000',
      border: '#A3A3A3',
      call: '#FF0000'
    }
  },

  constructor: function (config) {  
    $.extend(this, this.defaults, config);
    this.initTracks();
  },
  
  initTracks: function () {
    this.height = 0;
    
    if (!this.tracks) {
      return false;
    }
    
    for (var i = 0; i < this.tracks.length; i++) {
      //Copy some default values from cBrowse to Track
      var track = $.extend({
        width:   this.width,
        colors:  this.colors,
        cBrowse: this,
        offsetY: this.height,
        i:       i
      }, this.tracks[i]);
      
      //TODO: bless
      this.tracks[i] = new CBrowseTrack(track);
      this.height   += track.height;
    }
  },
  
  setChromosome: function (n) {
    if (chromosomes[n]) {
      this.chromosome = chromosomes[n];
    } else {
      this.die("Unknown chromosome " + n);
    }
  },
  
  setRange: function (start, stop) {
    this.start = parseInt(start, 10);
    this.stop  = parseInt(stop, 10);
    this.zoom  = this.chromosome.size / (this.stop - this.start);
    this.initScale();
  },
  
  setTracks: function (tracks) {
    this.tracks = tracks;
  },
  
  // Get data for each track in this.tracks
  getDataAndPlot: function () {
    this.ajaxCounter = 0;
    
    for (var i = 0; i < this.tracks.length; i++) {
      this.tracks[i].getDataAndPlotWhenAllFinished();
    }
  },
  
  initDOM: function () {
    this.window      = $('#window').css({ width: this.width, height: this.height });
    this.canvas      = $('canvas').attr('width', 3 * this.width).attr('height', this.height).css('left', -this.width)[0];
    this.mask        = $('#mask').css({ width: this.width, height: this.height, top: this.window.offset().top }).show();
    this.context     = this.canvas.getContext('2d');    
    this.offset      = $(this.canvas).offset();
    this.featureInfo = $('#feature_info');
    
    for (var i = 0; i < this.tracks.length; i++) {
      this.tracks[i].context = this.context;
    }
  },
  
  initScale: function () {
    this.scale   = this.zoom * this.width / this.chromosome.size;
    this.offsetX = this.start * this.scale;
    
    if (!this.stop && this.zoom === 1) {
      this.stop = this.chromosome.size;
    }
  },
  
  zoomIn: function (x) {
    var cBrowse = this;
    
    if (!x) {
      x = this.width / 2;
    }
    
    this.mask.show();
    
    var start = this.start + (x - 2*this.delta) / (2 * this.scale);
    var stop  = start + (this.stop - this.start) / 2;

    this.setRange(start, stop);
    
    setTimeout(function () { cBrowse.plot(); }, 100);
  },
  
  zoomOut: function (x) {
    var cBrowse = this;
    
    if (!x) {
      x = this.width / 2;
    }
    
    this.mask.show();
    
    var start = this.start - (x + this.delta) / this.scale;
    var stop  = start + 2 * (this.stop - this.start);

    if (start < 0) {
      start = 0;
    }
    
    if (stop > this.chromosome.size) {
      stop = this.chromosome.size;
    }

    this.setRange(start, stop);
    
    setTimeout(function () { cBrowse.plot(); }, 100);
  },
  
  initEventHandlers: function () {
    var cBrowse = this;
    
    $('a.zoom_in').click(function () {
      cBrowse.zoomIn();
    });
    
    $('a.zoom_out').click(function () {
      cBrowse.zoomOut();
    });
    
    $(this.canvas).dblclick(function (e) {
      var x = e.clientX - cBrowse.offset.left - cBrowse.width;
      cBrowse.zoomIn(x);
    });
    
    $(this.canvas).mousedown(function (e) {
      console.log('mousedown');
      
      if (cBrowse.zoom === 1) {
        return false;
      }
      
      cBrowse.dragging        = true;
      cBrowse.draggingOffsetX = e.clientX - cBrowse.delta;
    });
    
    $(this.canvas).mousemove(function (e) {
      if (!cBrowse.dragging) {
        var x = e.clientX - cBrowse.offset.left;
        var y = e.clientY - cBrowse.offset.top;
        
        for (var i = 0; i < cBrowse.tracks.length; i++) {
          var track = cBrowse.tracks[i];
          
          if (y > track.offsetY && y < track.offsetY + track.height) {
            track.mousemove(x, y);
            break;
          }
        }
      }
    });
    
    $(document).mousemove(function (e) {
      if (cBrowse.dragging) {
        var x = e.clientX - cBrowse.draggingOffsetX;
        
        cBrowse.lastClientX = e.clientX;
        cBrowse.hideFeatureInfo();
        cBrowse.offsetImage(x);
      }
    });
    
    $(document).mouseup(function (e) {
      console.log('mouseup');
      
      if (cBrowse.dragging) {
        cBrowse.dragging = false;
        cBrowse.delta    = e.clientX - cBrowse.draggingOffsetX;

        console.log('delta: ' + cBrowse.delta);
        
        if (Math.abs(cBrowse.delta) < cBrowse.width) {
          cBrowse.updateURL(cBrowse.delta);
          return false;
        }
        
        cBrowse.mask.show();
        
        cBrowse.start = cBrowse.start - cBrowse.delta/cBrowse.scale;
        
        if (cBrowse.delta > 0) {
          // moved right
          setTimeout(function () { cBrowse.plot(0, cBrowse.delta); }, 100);
          cBrowse.delta = 0;
        } else { 
          // moved left
          setTimeout(function () { cBrowse.plot(3*cBrowse.width + cBrowse.delta, 3*cBrowse.width); }, 100);
          cBrowse.delta = 0;
        }
      }
    });
  },
  
  hideFeatureInfo: function () {
    this.featureInfo.hide();
  },
  
  updateURL: function (delta) {
    var start, stop;
    
    if (delta) {
      start = this.start - delta / this.scale;
    } else {
      start = this.start;
    }
    
    stop = start + this.chromosome.size / this.zoom;
    
    history.pushState({}, "", this.baseURL + start + ";" + stop);
  },
  
  updateImage: function (x1, x2) {
    if (!x1 && !x2) {
      x1 = 0;
      x2 = 3 * this.width;
    }
    
    this.dataURL   = this.canvas.toDataURL();
    this.image.src = this.dataURL;
    
    this.mask.hide();
  },
  
  updateCallShortCuts: function () {
    var cBrowse = this;
    var select = $('#calls');
    
    for (var i = 0; i < this.tracks.length; i++) {
      var track = this.tracks[i];
      
      if (track.calls && track.calls.length) {
        for (var j = 0; j < track.calls.length; j++) {
          var call = track.calls[j];
          
          select.append($('<option>', call).text(
            "Source: " + track.name +
            "; Size "  + (call.stop - call.start) +
            "; Ratio " + call.ratio +
            "; "       + this.chromosome.id + ":" +call.start.toLocaleString() + "-" + call.stop.toLocaleString()
          ));
        }
        
        select.change(function () {
          var option = $('option:selected', this);
          
          if (!option.attr('start')) {
            return false;
          }
          
          cBrowse.mask.show();
          
          var start = parseInt(option.attr('start'), 10);
          var stop  = parseInt(option.attr('stop'),  10);
          var size  = stop - start;
          var k     = size < 100000 ? 20 : size < 1000000 ? 5 : 1;

          start = start - k*size;
          stop  = stop  + k*size;
          
          cBrowse.setRange(start, stop);
          
          setTimeout(function () { cBrowse.plot(); }, 100);
        });
        
        select.removeAttr('disabled');
      }
    }
  },
  
  plot: function (x1, x2) {
    console.time("plot");
    
    this.hideFeatureInfo();
    
    if (!x1 && !x2) {
      x1 = 0;
      x2 = 3*this.width;
    }
    
    //TODO: reset dragging offsets into separate routine
    this.delta             = 0;
    this.context.fillStyle = this.colors.foreground;
    this.offsetX           = this.start * this.scale;
    
    this.context.clearRect(x1, 0, x2, this.height);
    
    for (var i = 0; i < this.tracks.length; i++) {
      this.tracks[i].plot(x1, x2);
    }  
    
    //save canvas image as data url (png format by default)
    this.dataURL   = this.canvas.toDataURL();
    this.image.src = this.dataURL;
    
    this.mask.hide();

    console.timeEnd("plot");
    
    this.updateURL();
  },
  
  offsetImage: function (x) {
    this.context.clearRect(0, 0, 3*this.width, this.height);
    this.context.drawImage(this.image, x, 0);
  },
  
  render: function () {
    this.initDOM();
    this.initScale();
    this.getDataAndPlot();
    this.initEventHandlers();
  },
  
  die: function (error) {
    alert(error);
    throw(error);
  },
  
  warn: function (error) {
    alert(error);
  }
});