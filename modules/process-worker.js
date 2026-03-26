/**
 * Image Processing Web Worker
 * Runs the heavy image processing pipeline off the main thread
 * so UI interactions (dropdowns, typing, clicking) stay snappy.
 */
importScripts('image-processor.js');

self.onmessage = function(e) {
  var data = e.data;

  // Reconstruct ImageData-like object from transferred buffer
  var imageData = {
    data: new Uint8ClampedArray(data.pixels),
    width: data.width,
    height: data.height
  };

  var result = ImageProcessor.processFrame(imageData, data.styleName);

  // Copy results since internal buffers are reused across calls
  var edges = new Float32Array(result.edges);
  var brightness = new Float32Array(result.brightness);

  // Transfer ownership of the array buffers (zero-copy)
  self.postMessage({
    edges: edges,
    brightness: brightness,
    width: result.width,
    height: result.height
  }, [edges.buffer, brightness.buffer]);
};
