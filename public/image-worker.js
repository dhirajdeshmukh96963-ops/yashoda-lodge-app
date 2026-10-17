self.onmessage = async (event) => {
  const { blob, rotationDeg = 0, max = 1400 } = event.data || {};

  try {
    if (!blob || !(blob instanceof Blob)) {
      throw new Error('No image blob received by worker');
    }

    const imageBitmap = await createImageBitmap(blob);
    let width = imageBitmap.width;
    let height = imageBitmap.height;

    const sourceCanvas = new OffscreenCanvas(width, height);
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) {
      throw new Error('OffscreenCanvas 2D context not available');
    }

    if (rotationDeg === 90 || rotationDeg === 270) {
      sourceCanvas.width = height;
      sourceCanvas.height = width;
    }

    sourceCtx.save();
    sourceCtx.translate(sourceCanvas.width / 2, sourceCanvas.height / 2);
    sourceCtx.rotate((rotationDeg * Math.PI) / 180);
    sourceCtx.drawImage(imageBitmap, -width / 2, -height / 2);
    sourceCtx.restore();

    const scale = Math.min(1, max / Math.max(sourceCanvas.width, sourceCanvas.height));
    const targetW = Math.round(sourceCanvas.width * scale);
    const targetH = Math.round(sourceCanvas.height * scale);

    const finalCanvas = new OffscreenCanvas(targetW, targetH);
    const finalCtx = finalCanvas.getContext('2d');
    if (!finalCtx) {
      throw new Error('Final canvas 2D context not available');
    }

    finalCtx.drawImage(sourceCanvas, 0, 0, targetW, targetH);
    const processedBlob = await finalCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });

    self.postMessage({ type: 'processed', blob: processedBlob }, [processedBlob]);
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Image processing failed',
    });
  }
};
