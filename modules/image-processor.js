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
  function processFrame(imageData, styleName) {
    var style = STYLES[styleName || currentStyle] || STYLES.terminal;
    var w = imageData.width;
    var h = imageData.height;
    var gray = toGrayscale(imageData);

    // Sharpen to bring out facial detail
    var sharpened = sharpen(gray, w, h, style.sharpenAmount);

    // Edge detection on sharpened image
    var edges = sobelEdges(sharpened, w, h);

    // Brightness from sharpened source
    var brightness = brightnessMap(sharpened, w, h);

    // Gamma boost — pull detail out of shadows
    for (var k = 0; k < brightness.length; k++) {
      brightness[k] = Math.pow(brightness[k], style.gamma);
    }

    // Adaptive contrast — re-normalize after gamma to use full range
    var bMin = 1, bMax = 0;
    for (var n = 0; n < brightness.length; n++) {
      if (brightness[n] < bMin) bMin = brightness[n];
      if (brightness[n] > bMax) bMax = brightness[n];
    }
    var bRange = bMax - bMin || 1;
    for (var p = 0; p < brightness.length; p++) {
      brightness[p] = (brightness[p] - bMin) / bRange;
    }

    // Apply contrast
    brightness = contrastEnhance(brightness, w, h, style.contrast);

    // Posterize
    brightness = posterize(brightness, w, h, style.posterizeLevels);

    // Normalize edges to 0-1
    var maxEdge = 0;
    for (var i = 0; i < edges.length; i++) {
      if (edges[i] > maxEdge) maxEdge = edges[i];
    }
    if (maxEdge > 0) {
      for (var j = 0; j < edges.length; j++) {
        edges[j] = Math.min(edges[j] / maxEdge, 1.0);
      }
    }

    // Dither edges
    var ditheredEdges = orderedDither(edges, w, h, style.edgeDitherLevels);

    return {
      edges: ditheredEdges,
      brightness: brightness,
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
