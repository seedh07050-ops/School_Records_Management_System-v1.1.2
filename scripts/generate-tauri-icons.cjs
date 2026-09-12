const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Helper to create PNG buffer from RGBA buffer
function createPng(width, height, getPixel) {
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0; // Filter: none
    for (let x = 0; x < width; x++) {
      const px = getPixel(x, y);
      const pixelOffset = rowOffset + 1 + x * 4;
      scanlines[pixelOffset] = px.r;
      scanlines[pixelOffset + 1] = px.g;
      scanlines[pixelOffset + 2] = px.b;
      scanlines[pixelOffset + 3] = px.a;
    }
  }

  const idatData = zlib.deflateSync(scanlines);

  function createChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);

    const crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crcTable[n] = c;
    }
    let crc = 0xffffffff;
    for (let i = 4; i < 8 + len; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', idatData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
}

function sampleIcon(w, h, x, y) {
  const normX = x / w;
  const normY = y / h;

  // Outer margin
  const margin = 0.06;
  if (normX < margin || normX > 1 - margin || normY < margin || normY > 1 - margin) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // Rounded rectangle check
  const cornerR = 0.18;
  const cx = normX < margin + cornerR ? margin + cornerR : (normX > 1 - margin - cornerR ? 1 - margin - cornerR : normX);
  const cy = normY < margin + cornerR ? margin + cornerR : (normY > 1 - margin - cornerR ? 1 - margin - cornerR : normY);
  const dist = Math.hypot(normX - cx, normY - cy);
  if (dist > cornerR) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // Gradient background (Deep blue to vibrant royal blue)
  const grad = (normX + normY) / 2;
  const bgR = Math.round(30 + grad * 15);
  const bgG = Math.round(64 + grad * 35);
  const bgB = Math.round(175 + grad * 60);

  // Folder shape
  const inTab = (normX >= 0.22 && normX <= 0.45 && normY >= 0.22 && normY <= 0.32);
  const inBody = (normX >= 0.22 && normX <= 0.78 && normY >= 0.30 && normY <= 0.75);

  if (inTab || inBody) {
    // Document folder white body
    if (normY >= 0.42 && normY <= 0.46 && normX >= 0.30 && normX <= 0.60) {
      return { r: 37, g: 99, b: 235, a: 255 }; // blue line
    }
    if (normY >= 0.50 && normY <= 0.54 && normX >= 0.30 && normX <= 0.68) {
      return { r: 37, g: 99, b: 235, a: 255 }; // blue line
    }
    if (normY >= 0.58 && normY <= 0.62 && normX >= 0.30 && normX <= 0.52) {
      return { r: 37, g: 99, b: 235, a: 255 }; // blue line
    }
    // Emerald badge
    const sealDist = Math.hypot(normX - 0.65, normY - 0.62);
    if (sealDist <= 0.07) {
      return { r: 16, g: 185, b: 129, a: 255 };
    }
    return { r: 255, g: 255, b: 255, a: 255 };
  }

  return { r: bgR, g: bgG, b: bgB, a: 255 };
}

const iconsDir = path.resolve(__dirname, '../src-tauri/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Generate PNGs: 32x32, 128x128, 256x256 (128x128@2x), 512x512
const png32 = createPng(32, 32, (x, y) => sampleIcon(32, 32, x, y));
const png128 = createPng(128, 128, (x, y) => sampleIcon(128, 128, x, y));
const png256 = createPng(256, 256, (x, y) => sampleIcon(256, 256, x, y));
const png512 = createPng(512, 512, (x, y) => sampleIcon(512, 512, x, y));

fs.writeFileSync(path.join(iconsDir, '32x32.png'), png32);
fs.writeFileSync(path.join(iconsDir, '128x128.png'), png128);
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), png256);
fs.writeFileSync(path.join(iconsDir, 'icon.png'), png512);

// 2. Generate .ico with 256x256 PNG payload
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // Type: Icon
icoHeader.writeUInt16LE(1, 4); // Count: 1 image

const icoEntry = Buffer.alloc(16);
icoEntry.writeUInt8(0, 0); // Width: 256 (0 means 256)
icoEntry.writeUInt8(0, 1); // Height: 256 (0 means 256)
icoEntry.writeUInt8(0, 2); // Colors: 0
icoEntry.writeUInt8(0, 3); // Reserved
icoEntry.writeUInt16LE(1, 4); // Color planes
icoEntry.writeUInt16LE(32, 6); // Bits per pixel
icoEntry.writeUInt32LE(png256.length, 8); // Image size in bytes
icoEntry.writeUInt32LE(6 + 16, 12); // Image offset

const icoBuf = Buffer.concat([icoHeader, icoEntry, png256]);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuf);

// Copy 512x512 as icon.icns dummy / compatibility if needed
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), png512);

console.log('Tauri icons successfully generated in src-tauri/icons/');
