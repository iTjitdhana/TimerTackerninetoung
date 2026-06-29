import sharp from "sharp"
import { readFileSync } from "fs"
import { mkdir } from "fs/promises"

await mkdir("public/icons", { recursive: true })
const svg = readFileSync("public/icon.svg")

await sharp(svg).resize(192, 192).png().toFile("public/icons/icon-192.png")
await sharp(svg).resize(512, 512).png().toFile("public/icons/icon-512.png")

// maskable: เพิ่ม safe zone padding 10% รอบ icon
const size = 192
const pad = Math.round(size * 0.1)
await sharp({
  create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
}).composite([{
  input: await sharp(svg).resize(size - pad * 2, size - pad * 2).png().toBuffer(),
  left: pad,
  top: pad,
}]).png().toFile("public/icons/icon-maskable-192.png")

console.log("PWA icons generated in public/icons/")
