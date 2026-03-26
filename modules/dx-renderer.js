/**
 * Deus Ex Character Renderer Module
 * Renders processed webcam frames as a subtle CRT reflection overlay
 * on the editor pane — like seeing JC Denton's face reflected in the monitor.
 *
 * Uses a canvas overlay with low opacity, green/cyan phosphor coloring,
 * and scanline integration to match the Deus Ex terminal aesthetic.
 */
var DXRenderer = (function() {
  var overlayCanvas = null;
  var ctx = null;
  var isVisible = false;
  var currentOpacity = 0.12;
  var targetOpacity = 0.12;
  var colorMode = 'green'; // 'green', 'cyan', 'amber'
  var containerEl = null;
  var renderWidth = 0;
  var renderHeight = 0;
  var renderStyle = 'terminal';
  var cachedImgData = null;
  var cachedStyleObj = null;

  var COLOR_PRESETS = {
    green:  { r: 40, g: 232, b: 160, edge: { r: 80, g: 255, b: 180 } },
    cyan:   { r: 0, g: 200, b: 255, edge: { r: 60, g: 230, b: 255 } },
    amber:  { r: 200, g: 168, b: 50, edge: { r: 230, g: 200, b: 80 } },
    // Mass Effect
    meblue: { r: 80, g: 150, b: 255, edge: { r: 140, g: 200, b: 255 } },
    mered:  { r: 255, g: 90, b: 30, edge: { r: 255, g: 150, b: 80 } },
    // Star Trek TNG
    lcars:    { r: 255, g: 180, b: 80, edge: { r: 255, g: 210, b: 130 } },
    holodeck: { r: 0, g: 200, b: 200, edge: { r: 80, g: 240, b: 240 } },
    // Twin Peaks
    redroom:  { r: 200, g: 30, b: 30, edge: { r: 255, g: 80, b: 80 } },
    owlgray:  { r: 180, g: 180, b: 190, edge: { r: 220, g: 220, b: 230 } },
    // Peanuts
    cartoon:  { r: 255, g: 210, b: 70, edge: { r: 50, g: 40, b: 30 } },
    pencil:   { r: 60, g: 50, b: 40, edge: { r: 30, g: 25, b: 20 } },
    // WoW
    wowblue:  { r: 80, g: 140, b: 255, edge: { r: 200, g: 180, b: 100 } },
    wowred:   { r: 200, g: 40, b: 20, edge: { r: 255, g: 100, b: 50 } }
  };

  // Render style configs — control how edges/fill are blended
  var RENDER_STYLES = {
    terminal: {
      edgePow: 0.5, edgeMul: 1.5, edgeThreshold: 0.2,
      fillMul: 0.85, darkCutoff: 0.1, alphaFill: 230, alphaEdge: 240,
      edgeBlendMode: 'max',  // edges add on top
      resDiv: 2
    },
    polygon: {
      edgePow: 0.4, edgeMul: 1.5, edgeThreshold: 0.2,
      fillMul: 0.95, darkCutoff: 0.05, alphaFill: 240, alphaEdge: 230,
      edgeBlendMode: 'outline',  // edges are dark outlines between bands
      resDiv: 2.5  // slightly blockier for polygonal look
    },
    wireframe: {
      edgePow: 0.4, edgeMul: 2.5, edgeThreshold: 0.1,
      fillMul: 0.2, darkCutoff: 0.0, alphaFill: 60, alphaEdge: 255,
      edgeBlendMode: 'max',
      resDiv: 3
    },
    // Mass Effect — Paragon: smooth holographic glow
    paragon: {
      edgePow: 0.5, edgeMul: 1.2, edgeThreshold: 0.15,
      fillMul: 0.9, darkCutoff: 0.08, alphaFill: 220, alphaEdge: 200,
      edgeBlendMode: 'max',
      resDiv: 1.5
    },
    // Mass Effect — Renegade: harsh, aggressive
    renegade: {
      edgePow: 0.4, edgeMul: 2.0, edgeThreshold: 0.15,
      fillMul: 0.8, darkCutoff: 0.12, alphaFill: 240, alphaEdge: 250,
      edgeBlendMode: 'max',
      resDiv: 2
    },
    // Star Trek — LCARS: clean, high-res scan
    lcars: {
      edgePow: 0.6, edgeMul: 1.0, edgeThreshold: 0.2,
      fillMul: 0.95, darkCutoff: 0.05, alphaFill: 210, alphaEdge: 180,
      edgeBlendMode: 'max',
      resDiv: 1.5
    },
    // Star Trek — Holodeck: grid wireframe
    holodeck: {
      edgePow: 0.4, edgeMul: 2.2, edgeThreshold: 0.1,
      fillMul: 0.15, darkCutoff: 0.0, alphaFill: 50, alphaEdge: 240,
      edgeBlendMode: 'max',
      resDiv: 2.5
    },
    // Twin Peaks — Black Lodge: surreal high contrast
    blacklodge: {
      edgePow: 0.3, edgeMul: 1.8, edgeThreshold: 0.1,
      fillMul: 0.7, darkCutoff: 0.15, alphaFill: 250, alphaEdge: 255,
      edgeBlendMode: 'max',
      resDiv: 2
    },
    // Twin Peaks — Owls: moody, dark edges
    owls: {
      edgePow: 0.4, edgeMul: 2.0, edgeThreshold: 0.12,
      fillMul: 0.3, darkCutoff: 0.1, alphaFill: 100, alphaEdge: 230,
      edgeBlendMode: 'max',
      resDiv: 2.5
    },
    // Peanuts — Cartoon: thick outlines, solid fill
    cartoon: {
      edgePow: 0.3, edgeMul: 1.5, edgeThreshold: 0.15,
      fillMul: 1.0, darkCutoff: 0.05, alphaFill: 250, alphaEdge: 250,
      edgeBlendMode: 'outline',
      resDiv: 2
    },
    // Peanuts — Sketch: pencil lines only
    sketch: {
      edgePow: 0.35, edgeMul: 2.8, edgeThreshold: 0.08,
      fillMul: 0.1, darkCutoff: 0.0, alphaFill: 40, alphaEdge: 255,
      edgeBlendMode: 'max',
      resDiv: 2
    },
    // WoW — Alliance: noble blue/gold glow
    alliance: {
      edgePow: 0.5, edgeMul: 1.3, edgeThreshold: 0.18,
      fillMul: 0.85, darkCutoff: 0.1, alphaFill: 230, alphaEdge: 220,
      edgeBlendMode: 'max',
      resDiv: 2
    },
    // WoW — Horde: red aggressive, hard edges
    horde: {
      edgePow: 0.4, edgeMul: 1.8, edgeThreshold: 0.15,
      fillMul: 0.75, darkCutoff: 0.12, alphaFill: 240, alphaEdge: 250,
      edgeBlendMode: 'max',
      resDiv: 2
    }
  };

  function init(container, options) {
    options = options || {};
    containerEl = container;
    colorMode = options.colorMode || 'green';
    currentOpacity = options.opacity || 0.12;
    targetOpacity = currentOpacity;
    renderStyle = options.renderStyle || 'terminal';

    overlayCanvas = document.createElement('canvas');
    overlayCanvas.className = 'dx-reflection-overlay';
    overlayCanvas.style.cssText = [
      'position: absolute',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      'pointer-events: none',
      'z-index: 10',
      'opacity: ' + currentOpacity,
      'mix-blend-mode: screen',
      'filter: blur(1px)'
    ].join(';');

    containerEl.style.position = 'relative';
    containerEl.appendChild(overlayCanvas);

    _resize();
    window.addEventListener('resize', _resize);
    isVisible = true;
  }

  function _resize() {
    if (!containerEl || !overlayCanvas) return;
    var rect = containerEl.getBoundingClientRect();
    cachedStyleObj = RENDER_STYLES[renderStyle] || RENDER_STYLES.terminal;
    renderWidth = Math.floor(rect.width / cachedStyleObj.resDiv);
    renderHeight = Math.floor(rect.height / cachedStyleObj.resDiv);
    overlayCanvas.width = renderWidth;
    overlayCanvas.height = renderHeight;
    ctx = overlayCanvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      cachedImgData = ctx.createImageData(renderWidth, renderHeight);
    }
  }

  /**
   * Render a processed frame onto the overlay canvas.
   * @param {Object} processed - Output from ImageProcessor.processFrame()
   */
  function renderFrame(processed) {
    if (!ctx || !isVisible || !processed || !cachedImgData) return;

    var colors = COLOR_PRESETS[colorMode] || COLOR_PRESETS.green;
    var rs = cachedStyleObj || RENDER_STYLES.terminal;
    var srcW = processed.width;
    var srcH = processed.height;
    var edges = processed.edges;
    var brightness = processed.brightness;
    var pixels = cachedImgData.data;

    // Pre-compute color * fill multiplier
    var cr = colors.r, cg = colors.g, cb = colors.b;
    var er = colors.edge.r, eg = colors.edge.g, eb = colors.edge.b;
    var fillMul = rs.fillMul;
    var darkCutoff = rs.darkCutoff;
    var edgePow = rs.edgePow;
    var edgeMul = rs.edgeMul;
    var edgeThreshold = rs.edgeThreshold;
    var alphaFill = rs.alphaFill;
    var alphaEdge = rs.alphaEdge;
    var isOutline = rs.edgeBlendMode === 'outline';

    // Scale factors
    var scaleX = srcW / renderWidth;
    var scaleY = srcH / renderHeight;

    for (var y = 0; y < renderHeight; y++) {
      var scanMul = (y & 1) ? 1.0 : 0.88;
      var srcY = (y * scaleY) | 0;
      var rowOff = srcY * srcW;
      var outRow = y * renderWidth;

      for (var x = 0; x < renderWidth; x++) {
        var srcIdx = rowOff + ((x * scaleX) | 0);
        var edge = edges[srcIdx];
        var bright = brightness[srcIdx];

        var r, g, b, a;

        if (bright < darkCutoff) {
          r = 0; g = 0; b = 0; a = 0;
        } else {
          r = cr * bright * fillMul;
          g = cg * bright * fillMul;
          b = cb * bright * fillMul;
          a = bright * alphaFill;
        }

        var edgeStrength = Math.pow(edge, edgePow) * edgeMul;
        if (edgeStrength > edgeThreshold) {
          var edgeBoost = edgeStrength < 1.0 ? edgeStrength : 1.0;
          if (isOutline) {
            var darken = 1.0 - edgeBoost * 0.7;
            r *= darken; g *= darken; b *= darken;
            if (edgeBoost > 0.6) {
              var er3 = er * 0.3, eg3 = eg * 0.3, eb3 = eb * 0.3;
              if (er3 > r) r = er3;
              if (eg3 > g) g = eg3;
              if (eb3 > b) b = eb3;
            }
            var ea = edgeBoost * alphaEdge;
            if (ea > a) a = ea;
          } else {
            var erb = er * edgeBoost * 0.8;
            var egb = eg * edgeBoost * 0.8;
            var ebb = eb * edgeBoost * 0.8;
            if (erb > r) r = erb;
            if (egb > g) g = egb;
            if (ebb > b) b = ebb;
            var ea2 = edgeBoost * alphaEdge;
            if (ea2 > a) a = ea2;
          }
        }

        a *= scanMul;

        var outIdx = (outRow + x) * 4;
        pixels[outIdx]     = r < 255 ? r : 255;
        pixels[outIdx + 1] = g < 255 ? g : 255;
        pixels[outIdx + 2] = b < 255 ? b : 255;
        pixels[outIdx + 3] = a < 255 ? a : 255;
      }
    }

    ctx.putImageData(cachedImgData, 0, 0);
  }

  function setOpacity(opacity) {
    targetOpacity = Math.max(0, Math.min(0.6, opacity));
    currentOpacity = targetOpacity;
    if (overlayCanvas) {
      overlayCanvas.style.opacity = currentOpacity;
    }
  }

  function setColorMode(mode) {
    if (COLOR_PRESETS[mode]) {
      colorMode = mode;
    }
  }

  function setRenderStyle(style) {
    if (RENDER_STYLES[style]) {
      renderStyle = style;
      cachedStyleObj = RENDER_STYLES[style];
      _resize();  // re-apply resolution
    }
  }

  function getRenderStyle() {
    return renderStyle;
  }

  function show() {
    isVisible = true;
    if (overlayCanvas) overlayCanvas.style.display = '';
  }

  function hide() {
    isVisible = false;
    if (overlayCanvas) overlayCanvas.style.display = 'none';
  }

  function toggle() {
    if (isVisible) hide(); else show();
    return isVisible;
  }

  function destroy() {
    isVisible = false;
    window.removeEventListener('resize', _resize);
    if (overlayCanvas && overlayCanvas.parentNode) {
      overlayCanvas.parentNode.removeChild(overlayCanvas);
    }
    overlayCanvas = null;
    ctx = null;
    cachedImgData = null;
    cachedStyleObj = null;
  }

  function getStatus() {
    return {
      isVisible: isVisible,
      colorMode: colorMode,
      opacity: currentOpacity,
      renderWidth: renderWidth,
      renderHeight: renderHeight
    };
  }

  return {
    init: init,
    renderFrame: renderFrame,
    setOpacity: setOpacity,
    setColorMode: setColorMode,
    show: show,
    hide: hide,
    toggle: toggle,
    destroy: destroy,
    getStatus: getStatus,
    setRenderStyle: setRenderStyle,
    getRenderStyle: getRenderStyle,
    COLOR_PRESETS: COLOR_PRESETS,
    RENDER_STYLES: RENDER_STYLES
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DXRenderer;
}
