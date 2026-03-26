/**
 * Image Processor Module
 * Transforms webcam frames into Deus Ex-style visuals:
 * - Edge detection (Sobel filter) for that augmented reality wireframe look
 * - Green/cyan phosphor colorization
 * - Dithering for retro CRT feel
 * - Silhouette extraction
 */
var ImageProcessor = (function() {

  /**
   * Convert ImageData to grayscale float array
   */
  function toGrayscale(imageData) {
    var data = imageData.data;
    var w = imageData.width;
    var h = imageData.height;
    var gray = new Float32Array(w * h);
    for (var i = 0; i < w * h; i++) {
      var idx = i * 4;
      // Luminance formula
      gray[i] = data[idx] * 0.299 + data[idx+1] * 0.587 + data[idx+2] * 0.114;
    }
    return gray;
  }

  /**
   * Apply Gaussian blur (3x3) for noise reduction before edge detection
   */
  function gaussianBlur(gray, w, h) {
    var kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
    var kSum = 16;
    var out = new Float32Array(w * h);

    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var sum = 0;
        var ki = 0;
        for (var ky = -1; ky <= 1; ky++) {
          for (var kx = -1; kx <= 1; kx++) {
            sum += gray[(y + ky) * w + (x + kx)] * kernel[ki++];
          }
        }
        out[y * w + x] = sum / kSum;
      }
    }
    return out;
  }

  /**
   * Sobel edge detection — gives that augmented reality wireframe look
   */
  function sobelEdges(gray, w, h) {
    var blurred = gaussianBlur(gray, w, h);
    var edges = new Float32Array(w * h);
    var sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    var sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var gx = 0, gy = 0;
        var ki = 0;
        for (var ky = -1; ky <= 1; ky++) {
          for (var kx = -1; kx <= 1; kx++) {
            var val = blurred[(y + ky) * w + (x + kx)];
            gx += val * sobelX[ki];
            gy += val * sobelY[ki];
            ki++;
          }
        }
        edges[y * w + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    return edges;
  }

  /**
   * Create a brightness map (for silhouette/glow effect)
   */
  function brightnessMap(gray, w, h) {
    var out = new Float32Array(w * h);
    var max = 0;
    for (var i = 0; i < gray.length; i++) {
      if (gray[i] > max) max = gray[i];
    }
    if (max === 0) max = 1;
    for (var j = 0; j < gray.length; j++) {
      out[j] = gray[j] / max;
    }
    return out;
  }

  /**
   * Ordered dithering (4x4 Bayer matrix) for retro CRT look
   */
  function orderedDither(values, w, h, levels) {
    levels = levels || 4;
    var bayer = [
       0,  8,  2, 10,
      12,  4, 14,  6,
       3, 11,  1,  9,
      15,  7, 13,  5
    ];
    var out = new Float32Array(w * h);
    var step = 1.0 / levels;

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = y * w + x;
        var threshold = (bayer[(y % 4) * 4 + (x % 4)] + 0.5) / 16.0;
        var val = values[idx];
        out[idx] = val > threshold * step + (1 - step) * val ? Math.min(val * 1.5, 1.0) : val * 0.3;
      }
    }
    return out;
  }

  /**
   * Enhance contrast — pull darks darker and lights lighter
   * to bring out facial features like eyes, nose, jawline
   */
  function contrastEnhance(values, w, h, strength) {
    strength = strength || 1.5;
    var out = new Float32Array(w * h);
    for (var i = 0; i < values.length; i++) {
      // S-curve contrast: push values away from 0.5
      var v = values[i];
      v = (v - 0.5) * strength + 0.5;
      out[i] = Math.max(0, Math.min(1, v));
    }
    return out;
  }

  /**
   * Posterize — reduce to N brightness levels for that video game look
   * Makes faces look like low-poly shaded game characters
   */
  function posterize(values, w, h, levels) {
    levels = levels || 6;
    var out = new Float32Array(w * h);
    for (var i = 0; i < values.length; i++) {
      out[i] = Math.round(values[i] * levels) / levels;
    }
    return out;
  }

  /**
   * Sharpen (unsharp mask) — enhances facial detail
   */
  function sharpen(gray, w, h, amount) {
    amount = amount || 0.5;
    var blurred = gaussianBlur(gray, w, h);
    var out = new Float32Array(w * h);
    for (var i = 0; i < gray.length; i++) {
      // Unsharp mask: original + amount * (original - blurred)
      out[i] = Math.max(0, Math.min(255, gray[i] + amount * (gray[i] - blurred[i])));
    }
    return out;
  }

  /**
   * Style presets for different visual looks
   */
  var STYLES = {
    // Style 1: "Terminal" — current look, good face detail with posterized shading
    terminal: {
      gamma: 0.35,
      sharpenAmount: 0.7,
      contrast: 2.0,
      posterizeLevels: 5,
      edgeDitherLevels: 8,
      ditherBrightness: false
    },
    // Style 2: "Polygon" — hard cel-shading, thick outlines, fewer color bands
    polygon: {
      gamma: 0.3,
      sharpenAmount: 0.8,
      contrast: 1.8,
      posterizeLevels: 4,
      edgeDitherLevels: 12,
      ditherBrightness: false
    },
    // Style 3: "Wireframe" — mostly edges, minimal fill, like augmented vision
    wireframe: {
      gamma: 0.5,
      sharpenAmount: 0.9,
      contrast: 1.5,
      posterizeLevels: 2,
      edgeDitherLevels: 6,
      ditherBrightness: false
    },
    // Mass Effect — Paragon: smooth blue hologram, ethereal glow
    paragon: {
      gamma: 0.4,
      sharpenAmount: 0.6,
      contrast: 1.6,
      posterizeLevels: 6,
      edgeDitherLevels: 10,
      ditherBrightness: false
    },
    // Mass Effect — Renegade: harsh orange/red, high contrast
    renegade: {
      gamma: 0.3,
      sharpenAmount: 0.8,
      contrast: 2.2,
      posterizeLevels: 4,
      edgeDitherLevels: 6,
      ditherBrightness: false
    },
    // Star Trek TNG — LCARS: clean amber scan
    lcars: {
      gamma: 0.4,
      sharpenAmount: 0.5,
      contrast: 1.4,
      posterizeLevels: 8,
      edgeDitherLevels: 12,
      ditherBrightness: false
    },
    // Star Trek TNG — Holodeck: blue grid wireframe
    holodeck: {
      gamma: 0.5,
      sharpenAmount: 0.9,
      contrast: 1.3,
      posterizeLevels: 3,
      edgeDitherLevels: 6,
      ditherBrightness: false
    },
    // Twin Peaks — Black Lodge: surreal high contrast
    blacklodge: {
      gamma: 0.25,
      sharpenAmount: 0.7,
      contrast: 2.5,
      posterizeLevels: 3,
      edgeDitherLevels: 4,
      ditherBrightness: false
    },
    // Twin Peaks — Owls: dark moody edges
    owls: {
      gamma: 0.35,
      sharpenAmount: 0.9,
      contrast: 2.0,
      posterizeLevels: 2,
      edgeDitherLevels: 8,
      ditherBrightness: false
    },
    // Peanuts — Cartoon: heavy posterization, round cel-shading
    cartoon: {
      gamma: 0.3,
      sharpenAmount: 0.6,
      contrast: 1.5,
      posterizeLevels: 4,
      edgeDitherLevels: 16,
      ditherBrightness: false
    },
    // Peanuts — Sketch: pencil outline, minimal fill
    sketch: {
      gamma: 0.5,
      sharpenAmount: 1.0,
      contrast: 1.2,
      posterizeLevels: 2,
      edgeDitherLevels: 4,
      ditherBrightness: false
    },
    // WoW — Alliance: blue/gold noble glow
    alliance: {
      gamma: 0.35,
      sharpenAmount: 0.7,
      contrast: 1.8,
      posterizeLevels: 5,
      edgeDitherLevels: 8,
      ditherBrightness: false
    },
    // WoW — Horde: red aggressive, hard contrast
    horde: {
      gamma: 0.3,
      sharpenAmount: 0.8,
      contrast: 2.0,
      posterizeLevels: 4,
      edgeDitherLevels: 6,
      ditherBrightness: false
    }
  };

  var currentStyle = 'terminal';

  // Pre-allocated buffers for frame processing (avoid GC pressure)
  var _bufW = 0, _bufH = 0;
  var _grayBuf = null;
  var _blurBuf1 = null;
  var _blurBuf2 = null;
  var _edgeBuf = null;
  var _brightBuf = null;
  var _sharpenBuf = null;
  var _contrastBuf = null;
  var _posterBuf = null;
  var _ditherBuf = null;

  function _ensureBuffers(w, h) {
    if (_bufW === w && _bufH === h) return;
    var size = w * h;
    _bufW = w;
    _bufH = h;
    _grayBuf = new Float32Array(size);
    _blurBuf1 = new Float32Array(size);
    _blurBuf2 = new Float32Array(size);
    _edgeBuf = new Float32Array(size);
    _brightBuf = new Float32Array(size);
    _sharpenBuf = new Float32Array(size);
    _contrastBuf = new Float32Array(size);
    _posterBuf = new Float32Array(size);
    _ditherBuf = new Float32Array(size);
  }

  function setStyle(name) {
    if (STYLES[name]) {
      currentStyle = name;
    }
  }

  function getStyle() {
    return currentStyle;
  }

  function getStyleNames() {
    return Object.keys(STYLES);
  }

  /**
   * Process a full frame into Deus Ex style output.
   * Returns an object with edge data and brightness for the renderer.
   */
  /**
   * Fast in-place versions of processing functions that reuse pre-allocated buffers
   */
  function _toGrayscaleInto(imageData, out) {
    var data = imageData.data;
    var len = imageData.width * imageData.height;
    for (var i = 0; i < len; i++) {
      var idx = i * 4;
      out[i] = data[idx] * 0.299 + data[idx+1] * 0.587 + data[idx+2] * 0.114;
    }
  }

  function _gaussianBlurInto(gray, w, h, out) {
    var kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
    // Zero edges
    for (var e = 0; e < w; e++) { out[e] = 0; out[(h-1)*w+e] = 0; }
    for (var e2 = 0; e2 < h; e2++) { out[e2*w] = 0; out[e2*w+w-1] = 0; }
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var sum = 0;
        var ki = 0;
        for (var ky = -1; ky <= 1; ky++) {
          for (var kx = -1; kx <= 1; kx++) {
            sum += gray[(y + ky) * w + (x + kx)] * kernel[ki++];
          }
        }
        out[y * w + x] = sum * 0.0625; // /16
      }
    }
  }

  function _sharpenInto(gray, w, h, amount, blurBuf, out) {
    _gaussianBlurInto(gray, w, h, blurBuf);
    for (var i = 0, len = w * h; i < len; i++) {
      out[i] = Math.max(0, Math.min(255, gray[i] + amount * (gray[i] - blurBuf[i])));
    }
  }

  function _sobelEdgesInto(sharpened, w, h, blurBuf, out) {
    _gaussianBlurInto(sharpened, w, h, blurBuf);
    var sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    var sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    // Zero edges
    for (var e = 0; e < w; e++) { out[e] = 0; out[(h-1)*w+e] = 0; }
    for (var e2 = 0; e2 < h; e2++) { out[e2*w] = 0; out[e2*w+w-1] = 0; }
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var gx = 0, gy = 0;
        var ki = 0;
        for (var ky = -1; ky <= 1; ky++) {
          for (var kx = -1; kx <= 1; kx++) {
            var val = blurBuf[(y + ky) * w + (x + kx)];
            gx += val * sobelX[ki];
            gy += val * sobelY[ki];
            ki++;
          }
        }
        out[y * w + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }
  }

  function processFrame(imageData, styleName) {
    var style = STYLES[styleName || currentStyle] || STYLES.terminal;
    var w = imageData.width;
    var h = imageData.height;
    var len = w * h;

    _ensureBuffers(w, h);

    // Grayscale into pre-allocated buffer
    _toGrayscaleInto(imageData, _grayBuf);

    // Sharpen (uses _blurBuf1 internally)
    _sharpenInto(_grayBuf, w, h, style.sharpenAmount, _blurBuf1, _sharpenBuf);

    // Edge detection (uses _blurBuf2 internally)
    _sobelEdgesInto(_sharpenBuf, w, h, _blurBuf2, _edgeBuf);

    // Brightness map in-place into _brightBuf
    var max = 0;
    for (var i = 0; i < len; i++) {
      if (_sharpenBuf[i] > max) max = _sharpenBuf[i];
    }
    if (max === 0) max = 1;
    var invMax = 1 / max;
    for (var j = 0; j < len; j++) {
      _brightBuf[j] = _sharpenBuf[j] * invMax;
    }

    // Gamma boost
    var gamma = style.gamma;
    for (var k = 0; k < len; k++) {
      _brightBuf[k] = Math.pow(_brightBuf[k], gamma);
    }

    // Adaptive contrast — re-normalize
    var bMin = 1, bMax = 0;
    for (var n = 0; n < len; n++) {
      var bv = _brightBuf[n];
      if (bv < bMin) bMin = bv;
      if (bv > bMax) bMax = bv;
    }
    var invRange = 1 / ((bMax - bMin) || 1);
    for (var p = 0; p < len; p++) {
      _brightBuf[p] = (_brightBuf[p] - bMin) * invRange;
    }

    // Contrast enhance in-place
    var strength = style.contrast;
    for (var c = 0; c < len; c++) {
      var v = (_brightBuf[c] - 0.5) * strength + 0.5;
      _brightBuf[c] = v < 0 ? 0 : (v > 1 ? 1 : v);
    }

    // Posterize in-place
    var levels = style.posterizeLevels;
    for (var q = 0; q < len; q++) {
      _brightBuf[q] = Math.round(_brightBuf[q] * levels) / levels;
    }

    // Normalize edges to 0-1
    var maxEdge = 0;
    for (var ei = 0; ei < len; ei++) {
      if (_edgeBuf[ei] > maxEdge) maxEdge = _edgeBuf[ei];
    }
    if (maxEdge > 0) {
      var invEdge = 1 / maxEdge;
      for (var ej = 0; ej < len; ej++) {
        var ev = _edgeBuf[ej] * invEdge;
        _edgeBuf[ej] = ev > 1 ? 1 : ev;
      }
    }

    // Dither edges into _ditherBuf
    var ditherLevels = style.edgeDitherLevels;
    var bayer = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
    var step = 1.0 / ditherLevels;
    for (var dy = 0; dy < h; dy++) {
      for (var dx = 0; dx < w; dx++) {
        var didx = dy * w + dx;
        var threshold = (bayer[(dy % 4) * 4 + (dx % 4)] + 0.5) * 0.0625; // /16
        var dval = _edgeBuf[didx];
        _ditherBuf[didx] = dval > threshold * step + (1 - step) * dval ? Math.min(dval * 1.5, 1.0) : dval * 0.3;
      }
    }

    return {
      edges: _ditherBuf,
      brightness: _brightBuf,
      width: w,
      height: h
    };
  }

  // Public API
  return {
    processFrame: processFrame,
    toGrayscale: toGrayscale,
    sobelEdges: sobelEdges,
    brightnessMap: brightnessMap,
    contrastEnhance: contrastEnhance,
    posterize: posterize,
    sharpen: sharpen,
    setStyle: setStyle,
    getStyle: getStyle,
    getStyleNames: getStyleNames,
    STYLES: STYLES,
    orderedDither: orderedDither,
    gaussianBlur: gaussianBlur
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageProcessor;
}
