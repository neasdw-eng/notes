/**
 * Webcam Module
 * Handles camera access and frame capture.
 * All processing stays local — no frames leave the browser.
 */
var WebcamModule = (function() {
  var video = null;
  var stream = null;
  var canvas = null;
  var ctx = null;
  var isActive = false;
  var frameCallbacks = [];
  var animFrameId = null;
  var captureWidth = 160;
  var captureHeight = 120;
  var targetFps = 15;
  var lastFrameTime = 0;
  var frameInterval = 1000 / 15;

  function init(width, height) {
    captureWidth = width || 160;
    captureHeight = height || 120;

    video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.style.display = 'none';
    document.body.appendChild(video);

    canvas = document.createElement('canvas');
    canvas.width = captureWidth;
    canvas.height = captureHeight;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  }

  function start() {
    if (isActive) return Promise.resolve();
    if (!video) init();

    return navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: captureWidth },
        height: { ideal: captureHeight },
        facingMode: 'user'
      },
      audio: false
    }).then(function(mediaStream) {
      stream = mediaStream;
      video.srcObject = stream;
      isActive = true;
      video.play();
      _captureLoop();
      return true;
    });
  }

  function stop() {
    isActive = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (stream) {
      stream.getTracks().forEach(function(t) { t.stop(); });
      stream = null;
    }
    if (video) {
      video.srcObject = null;
    }
  }

  function _captureLoop(timestamp) {
    if (!isActive) return;

    animFrameId = requestAnimationFrame(_captureLoop);

    // Throttle to target FPS to reduce CPU load
    if (timestamp - lastFrameTime < frameInterval) return;
    lastFrameTime = timestamp;

    if (video.readyState >= video.HAVE_CURRENT_DATA) {
      // Draw video frame to canvas (mirrored)
      ctx.save();
      ctx.translate(captureWidth, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, captureWidth, captureHeight);
      ctx.restore();

      var imageData = ctx.getImageData(0, 0, captureWidth, captureHeight);

      for (var i = 0; i < frameCallbacks.length; i++) {
        frameCallbacks[i](imageData, captureWidth, captureHeight);
      }
    }
  }

  function onFrame(callback) {
    frameCallbacks.push(callback);
  }

  function removeOnFrame(callback) {
    var idx = frameCallbacks.indexOf(callback);
    if (idx !== -1) frameCallbacks.splice(idx, 1);
  }

  function getStatus() {
    return {
      isActive: isActive,
      hasStream: stream !== null,
      width: captureWidth,
      height: captureHeight
    };
  }

  function destroy() {
    stop();
    frameCallbacks = [];
    if (video && video.parentNode) {
      video.parentNode.removeChild(video);
    }
    video = null;
    canvas = null;
    ctx = null;
  }

  return {
    init: init,
    start: start,
    stop: stop,
    onFrame: onFrame,
    removeOnFrame: removeOnFrame,
    getStatus: getStatus,
    destroy: destroy
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebcamModule;
}
