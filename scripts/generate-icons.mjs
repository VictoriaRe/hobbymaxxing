import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const source = await readFile(new URL("../public/app-icon.svg", import.meta.url));
const sizes = [
  { size: 192, path: new URL("../public/icon-192.png", import.meta.url) },
  { size: 512, path: new URL("../public/icon-512.png", import.meta.url) },
  { size: 512, path: new URL("../public/icon-512-maskable.png", import.meta.url) },
  { size: 180, path: new URL("../public/apple-touch-icon.png", import.meta.url) },
];

for (const { size, path } of sizes) {
  await sharp(source).resize(size, size).png().toFile(fileURLToPath(path));
}

const faviconPng = await sharp(source).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6);
header.writeUInt8(32, 7);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(faviconPng.length, 14);
header.writeUInt32LE(header.length, 18);
await writeFile(fileURLToPath(new URL("../src/app/favicon.ico", import.meta.url)), Buffer.concat([header, faviconPng]));
