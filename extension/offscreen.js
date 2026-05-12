// IA Mapper — Offscreen Document
// Stitches viewport captures into a single full-page screenshot using Canvas.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'STITCH_SCREENSHOTS') return;

  const { captures, pageWidth, pageHeight, viewportHeight, devicePixelRatio } = message;

  try {
    const dpr = devicePixelRatio || 1;
    const canvas = new OffscreenCanvas(
      Math.round(pageWidth * dpr),
      Math.round(pageHeight * dpr)
    );
    const ctx = canvas.getContext('2d');

    // Load all capture images and draw them
    const promises = captures.map((capture, index) => {
      return new Promise((resolve, reject) => {
        fetch(capture.dataUrl)
          .then((res) => res.blob())
          .then((blob) => createImageBitmap(blob))
          .then((bitmap) => {
            const yOffset = Math.round(capture.scrollY * dpr);
            ctx.drawImage(bitmap, 0, yOffset);
            bitmap.close();
            resolve();
          })
          .catch(reject);
      });
    });

    Promise.all(promises)
      .then(() => canvas.convertToBlob({ type: 'image/png' }))
      .then((blob) => {
        const reader = new FileReader();
        reader.onload = () => {
          sendResponse({ ok: true, dataUrl: reader.result });
        };
        reader.onerror = () => {
          sendResponse({ ok: false, error: 'Failed to read blob' });
        };
        reader.readAsDataURL(blob);
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err.message });
      });
  } catch (err) {
    sendResponse({ ok: false, error: err.message });
  }

  return true; // Keep channel open for async
});
