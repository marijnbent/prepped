/**
 * Generate PWA icons (192, 512, 180 apple-touch) from the flame SVG.
 *
 * Usage: npx tsx scripts/generate-icons.ts
 */
import sharp from "sharp";
import { join } from "path";

const publicDir = join(import.meta.dirname, "..", "public");

// Flame icon on amber background — matches the app's primary color
const flameSvg = (size: number) => {
  const padding = Math.round(size * 0.22);
  const iconSize = size - padding * 2;
  const radius = Math.round(size * 0.22);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#c2710c"/>
  <g transform="translate(${padding}, ${padding})">
    <svg viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z"/>
    </svg>
  </g>
</svg>`);
};

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of sizes) {
  await sharp(flameSvg(size))
    .png()
    .toFile(join(publicDir, name));
  console.log(`Generated ${name} (${size}x${size})`);
}

console.log("Done!");
