const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create a 256x256 RGBA PNG with a clean blue gradient & archive document folder emblem
const width = 256;
const height = 256;

// Create uncompressed scanlines: 1 filter byte (0) + width * 4 bytes per row
const scanlines = Buffer.alloc(height * (1 + width * 4));

function setPixel(x, y, r, g, b, a) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const offset = y * (1 + width * 4) + 1 + x * 4;
  scanlines[offset] = r;
  scanlines[offset + 1] = g;
  scanlines[offset + 2] = b;
  scanlines[offset + 3] = a;
}

// Background: rounded rectangle on clean slate
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    // Distance from center for rounded container
    const cornerR = 48;
    let inCard = false;
    if (x >= 16 && x <= 239 && y >= 16 && y <= 239) {
      const cx = x < 16 + cornerR ? 16 + cornerR : (x > 239 - cornerR ? 239 - cornerR : x);
      const cy = y < 16 + cornerR ? 16 + cornerR : (y > 239 - cornerR ? 239 - cornerR : y);
      const d = Math.hypot(x - cx, y - cy);
      if (d <= cornerR) inCard = true;
    }

    if (inCard) {
      // Elegant deep blue gradient: top-left (37, 99, 235) to bottom-right (29, 78, 216)
      const grad = (x + y) / (width + height);
      const r = Math.round(30 + grad * 15);
      const g = Math.round(64 + grad * 35);
      const b = Math.round(175 + grad * 60);
      setPixel(x, y, r, g, b, 255);
    } else {
      setPixel(x, y, 0, 0, 0, 0); // Transparent outer
    }
  }
}

// Draw Folder / Archive Box emblem in the center (pure white / soft slate)
for (let y = 60; y <= 190; y++) {
  for (let x = 50; x <= 206; x++) {
    // Folder tab (top-left)
    const inTab = (x >= 60 && x <= 110 && y >= 60 && y <= 80);
    // Main folder body
    const inBody = (x >= 60 && x <= 196 && y >= 80 && y <= 185);
    
    if (inTab || inBody) {
      // Shadow / border accent
      const isEdge = (x === 60 || x === 196 || y === 80 || y === 185 || (inTab && (y === 60 || x === 110)));
      if (isEdge) {
        setPixel(x, y, 191, 219, 254, 255); // light blue border
      } else {
        setPixel(x, y, 255, 255, 255, 255); // crisp white interior
      }
    }
  }
}

// Draw horizontal archive stripes & label inside folder
for (let y = 100; y <= 165; y++) {
  for (let x = 80; x <= 176; x++) {
    // Three lines representing documents / records
    if ((y >= 105 && y <= 112 && x <= 150) || 
        (y >= 122 && y <= 129 && x <= 166) || 
        (y >= 139 && y <= 146 && x <= 135)) {
      setPixel(x, y, 37, 99, 235, 255); // primary brand blue
    }
    // Checkmark / seal symbol at right (y: 140..170, x: 150..180)
    const distSeal = Math.hypot(x - 160, y - 155);
    if (distSeal <= 14) {
      if (distSeal >= 12) {
        setPixel(x, y, 16, 185, 129, 255); // emerald border
      } else {
        setPixel(x, y, 209, 250, 229, 255); // emerald fill
      }
    }
  }
}

// Compress scanlines with zlib deflate
const idatData = zlib.deflateSync(scanlines);

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);

  // CRC32 calculation for chunk type + data
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
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

// PNG Header
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// IHDR chunk
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8; // Bit depth: 8
ihdr[9] = 6; // Color type: 6 (RGBA)
ihdr[10] = 0; // Compression method: 0
ihdr[11] = 0; // Filter method: 0
ihdr[12] = 0; // Interlace method: 0
const ihdrChunk = createChunk('IHDR', ihdr);

// IDAT chunk
const idatChunk = createChunk('IDAT', idatData);

// IEND chunk
const iendChunk = createChunk('IEND', Buffer.alloc(0));

const pngBuffer = Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);

const outPath = path.resolve(__dirname, '../public/icon.png');
fs.writeFileSync(outPath, pngBuffer);
console.log('Successfully generated public/icon.png (' + pngBuffer.length + ' bytes)');
