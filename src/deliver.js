// Hands a finished image to the user: through the claude.ai viewer when embedded there, otherwise as a normal browser download.
export async function deliver(blob, filename) {
  if (window.claude && window.claude.use) {
    const dl = await window.claude.use('downloads');
    if (!dl) throw new Error('Saving files is not available in this view.');
    await dl.save({ filename, data: blob });
    return;
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

export function toBlob(canvas, fmt) {
  return new Promise((res, rej) => canvas.toBlob(
    b => b ? res(b) : rej(new Error('The browser could not encode an image this large. Try a smaller size.')),
    fmt === 'jpg' ? 'image/jpeg' : 'image/png', 0.95));
}
