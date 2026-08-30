// Обработка сгенерированных фото: сжатие в WebP и раскладка по папкам мини-апки.
// Запуск: node scripts/process_photos.mjs
import sharp from "sharp";
import { mkdir, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "tmp", "photos");
const PUBLIC = path.join(ROOT, "apps", "mini-app", "public", "images");
const ASSETS = path.join(ROOT, "assets", "avatars");
const DESKTOP = "C:\\Users\\denbi\\OneDrive\\Рабочий стол";

async function toWebp(src, dest, width) {
  await sharp(src).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(dest);
  console.log("webp:", path.relative(ROOT, dest));
}

async function toJpg(src, dest, width) {
  await sharp(src).resize({ width, withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(dest);
  console.log("jpg:", path.relative(ROOT, dest));
}

await mkdir(path.join(PUBLIC, "categories"), { recursive: true });
await mkdir(path.join(PUBLIC, "hero"), { recursive: true });
await mkdir(path.join(PUBLIC, "timer"), { recursive: true });
await mkdir(ASSETS, { recursive: true });

// B1–B8: категории практик (карточки 16:9, исходник 3:2)
const categories = ["meditation", "pranayama", "qigong", "reading", "mantra", "walk", "sleep", "gratitude"];
for (const name of categories) {
  await toWebp(path.join(SRC, `${name}.png`), path.join(PUBLIC, "categories", `${name}.webp`), 1200);
}

// C: hero-фон (светлая тема — лесные лучи, тёмная — рассвет у озера под тёмным оверлеем)
await toWebp(path.join(SRC, "walk.png"), path.join(PUBLIC, "hero", "dawn.webp"), 1536);
await toWebp(path.join(SRC, "meditation.png"), path.join(PUBLIC, "hero", "night.webp"), 1536);

// D: фон оверлея таймера (утро — медитация на пирсе, вечер — спальня со свечой)
await toWebp(path.join(SRC, "meditation.png"), path.join(PUBLIC, "timer", "morning.webp"), 1024);
await toWebp(path.join(SRC, "sleep.png"), path.join(PUBLIC, "timer", "night.webp"), 1024);

// Удаляем старые jpg категорий — ссылки в коде переходят на .webp
for (const old of ["qigong.jpg", "pranayama.jpg", "reading.jpg"]) {
  await rm(path.join(PUBLIC, "categories", old), { force: true });
}

// A: кандидаты аватара бота (загружаются в BotFather вручную)
const avatars = [
  ["bot-avatar.png", "avatar-lotus.jpg"],
  ["ChatGPT Image 30 авг. 2026 г., 21_38_19 (1).png", "avatar-photo-deck-valley.jpg"],
  ["ChatGPT Image 30 авг. 2026 г., 21_38_19 (2).png", "avatar-photo-lake-peaks.jpg"],
  ["ChatGPT Image 30 авг. 2026 г., 21_38_52 (1).png", "avatar-photo-deck-lake.jpg"],
  ["ChatGPT Image 30 авг. 2026 г., 21_38_53 (2).png", "avatar-night-art.jpg"],
  ["ChatGPT Image 30 авг. 2026 г., 21_39_03.png", "avatar-buddha.jpg"],
  ["ChatGPT Image 30 авг. 2026 г., 21_39_10 (1).png", "avatar-flat-1.jpg"],
  ["ChatGPT Image 30 авг. 2026 г., 21_39_10 (2).png", "avatar-flat-2.jpg"],
];
for (const [src, dest] of avatars) {
  const srcPath = src.startsWith("bot-avatar") ? path.join(SRC, src) : path.join(DESKTOP, src);
  await toJpg(srcPath, path.join(ASSETS, dest), 1024);
}

console.log("done");
