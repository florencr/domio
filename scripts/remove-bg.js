const { Jimp } = require("jimp");
const path = require("path");

async function removeWhiteBg(filePath) {
  const img = await Jimp.read(filePath);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const threshold = 248;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (w * y + x) * 4;
      const r = img.bitmap.data[idx];
      const g = img.bitmap.data[idx + 1];
      const b = img.bitmap.data[idx + 2];
      const a = img.bitmap.data[idx + 3];
      if (r >= threshold && g >= threshold && b >= threshold) {
        img.bitmap.data[idx + 3] = 0;
      }
    }
  }

  await img.write(filePath);
  console.log("Done:", filePath);
}

async function main() {
  const publicDir = path.join(__dirname, "..", "public");
  for (const name of ["domio-icon.png", "domio-logo.png"]) {
    const p = path.join(publicDir, name);
    try {
      await removeWhiteBg(p);
    } catch (e) {
      console.error(name, e.message);
    }
  }
}

main();
