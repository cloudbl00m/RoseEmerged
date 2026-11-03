// Alter the photographed dirt itself, retaining its original grains and pebbles.
const texture = new Image();
texture.src = '/assets/planter.webp';
const ready = texture.decode();
export function createSoilSurface() {
  const canvas = document.createElement('canvas');
  canvas.className = 'soil-surface';
  canvas.setAttribute('aria-hidden', 'true');
  ready.then(() => {
    canvas.width = texture.naturalWidth;
    canvas.height = texture.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(texture, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const u = x / canvas.width, v = y / canvas.height;
        const edge = Math.min((u - .105 + (v - .17) * .45) * 100,
          (.895 - u + (v - .17) * .45) * 100, (v - .17) * 140, (.268 - v) * 200);
        const offset = (y * canvas.width + x) * 4;
        const feather = Math.max(0, Math.min(1, edge));
        const patch = (Math.sin(x * .043 + Math.sin(y * .11) * 2) + Math.sin(y * .075 + x * .017)) * .035;
        const absorb = .66 + patch;
        pixels.data[offset] *= absorb;
        pixels.data[offset + 1] *= absorb;
        pixels.data[offset + 2] *= absorb * .96;
        pixels.data[offset + 3] *= feather;
      }
    }
    ctx.putImageData(pixels, 0, 0);
  }).catch(() => { canvas.remove(); });
  return canvas;
}
