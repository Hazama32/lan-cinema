import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "./prisma";
import { playbackWarning } from "./format";
import { parseName } from "./naming";

const run = promisify(execFile);

export const MEDIA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.MEDIA_DIR ?? "media");
export const POSTER_DIR = path.resolve(/*turbopackIgnore: true*/ ".cache", "posters");
export async function rescanFile(full: string) {
  const warnings: string[] = [];
  await processFile(full, warnings);
  return warnings;
}
const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
};

const relOf = (f: string) => path.relative(MEDIA_DIR, f).split(path.sep).join("/");

// ---------- 1. Metadata video lewat ffprobe ----------
type Stream = { codec_type?: string; codec_name?: string; width?: number; height?: number };
type Probe = { format?: { duration?: string }; streams?: Stream[] };

async function probe(file: string) {
  try {
    const { stdout } = await run(
      "ffprobe",
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
      { maxBuffer: 10 * 1024 * 1024, timeout: 30_000 },
    );
    const j: Probe = JSON.parse(stdout);
    const v = j.streams?.find((s) => s.codec_type === "video");
    const a = j.streams?.find((s) => s.codec_type === "audio");
    return {
      durationSec: Math.round(Number(j.format?.duration) || 0),
      width: v?.width ?? 0,
      height: v?.height ?? 0,
      videoCodec: v?.codec_name ?? null,
      audioCodec: a?.codec_name ?? null,
    };
  } catch {
    return null; // ffprobe tidak ada / file rusak / terlalu lama
  }
}

// ---------- 2. Telusuri folder ----------
const SKIP_DIR = /^[.@$]|^(system volume information|samples?)$/i;

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIR.test(e.name)) out.push(...(await walk(full)));
    } else if (MIME[path.extname(e.name).toLowerCase()]) out.push(full);
  }
  return out;
}

// ---------- 3. Subtitle di samping video ----------
const LANGS: Record<string, [string, string]> = {
  id: ["id", "Indonesia"], ind: ["id", "Indonesia"], indonesian: ["id", "Indonesia"],
  en: ["en", "English"], eng: ["en", "English"], english: ["en", "English"],
};

async function findSubtitles(video: string) {
  const dir = path.dirname(video);
  const stem = path.basename(video, path.extname(video));
  const info = parseName(relOf(video));
  const found: { filePath: string; language: string; label: string }[] = [];
  const seenPaths = new Set<string>();

  const dirs = [dir];
  const parentDir = path.dirname(dir);
  if (parentDir !== dir && parentDir !== MEDIA_DIR) {
    dirs.push(parentDir);
  }

  for (const d of dirs) {
    let files: string[] = [];
    try {
      files = await fs.readdir(d);
    } catch {
      continue;
    }

    for (const name of files) {
      const ext = path.extname(name).toLowerCase();
      if (ext !== ".srt" && ext !== ".vtt") continue;
      const subPath = path.join(d, name);
      const relSubPath = relOf(subPath);
      if (seenPaths.has(relSubPath)) continue;

      const s = name.slice(0, -ext.length);
      const sLower = s.toLowerCase();
      const stemLower = stem.toLowerCase();

      let matches = sLower === stemLower || sLower.startsWith(stemLower + ".");

      if (!matches && info.type !== "movie") {
        if (info.season && info.episode) {
          const sTag1 = `s${String(info.season).padStart(2, "0")}e${String(info.episode).padStart(2, "0")}`;
          const sTag2 = `s${info.season}e${info.episode}`;
          const sTag3 = `${info.season}x${String(info.episode).padStart(2, "0")}`;
          if (sLower.includes(sTag1) || sLower.includes(sTag2) || (sTag3 && sLower.includes(sTag3))) {
            matches = true;
          }
        }
        if (info.episode !== null && !matches) {
          const epStr = String(info.episode);
          const paddedEp = String(info.episode).padStart(2, "0");
          if (sLower === paddedEp || sLower === `ep${paddedEp}` || sLower === `ep${epStr}` || sLower === `episode ${epStr}` || sLower === `e${epStr}`) {
            matches = true;
          }
        }
      }

      if (!matches && files.length <= 4) {
        const langTags = ["id", "ind", "en", "eng", "sub", "subtitle", "indonesia", "english"];
        if (langTags.includes(sLower) || sLower.startsWith("sub")) {
          matches = true;
        }
      }

      if (matches) {
        seenPaths.add(relSubPath);
        const tag = sLower === stemLower ? "" : sLower.slice(stemLower.length + 1).toLowerCase();
        let langCode = "und";
        let langLabel = tag ? tag.toUpperCase() : "Subtitle";
        for (const [key, [code, label]] of Object.entries(LANGS)) {
          if (sLower.includes(key)) {
            langCode = code;
            langLabel = label;
            break;
          }
        }
        if (langCode === "und" && LANGS[tag]) {
          langCode = LANGS[tag][0];
          langLabel = LANGS[tag][1];
        }

        found.push({
          filePath: relSubPath,
          language: langCode,
          label: langLabel,
        });
      }
    }
  }

  return found.sort(
    (a, b) =>
      (a.language === "id" ? 0 : 1) - (b.language === "id" ? 0 : 1) ||
      a.filePath.localeCompare(b.filePath),
  );
}

// ---------- 4. Poster ----------
const IMG = [".jpg", ".jpeg", ".png", ".webp"];
const SEASON_DIR = /^(season|musim|seri|s)[\s._-]*\d+$/i;
const ff = (args: string[]) => run("ffmpeg", ["-v", "error", "-y", ...args], { timeout: 60_000 });

// Gambar di samping video. "poster/folder/cover" hanya berlaku bila foldernya khusus
// satu film, atau untuk series (poster seri); kalau tidak, semua film dalam satu folder
// akan memakai poster yang sama.
async function findLocalPoster(video: string, isSeries: boolean) {
  const dir = path.dirname(video);
  const stem = path.basename(video, path.extname(video)).toLowerCase();
  const dirs = [dir];
  if (isSeries && SEASON_DIR.test(path.basename(dir))) dirs.push(path.dirname(dir));

  for (const d of dirs) {
    const files = await fs.readdir(d);
    const lower = new Map(files.map((f) => [f.toLowerCase(), f]));
    const pick = (base: string) => IMG.map((e) => lower.get(base + e)).find(Boolean);
    const videosHere = files.filter((f) => MIME[path.extname(f).toLowerCase()]).length;

    const names = d === dir ? [`${stem}-poster`, stem] : [];
    if (isSeries || videosHere === 1) names.push("poster", "folder", "cover");
    for (const n of names) {
      const hit = pick(n);
      if (hit) return path.join(d, hit);
    }
  }
  return null;
}

// Hasil akhir selalu JPEG 360 px di .cache/posters, ringan untuk Wi-Fi.
// Mengembalikan nama file (disimpan di Media.posterPath) atau null.
async function ensurePoster(m: {
  id: number;
  full: string;
  durationSec: number;
  isSeries: boolean;
  current: string | null;
}) {
  const exists = (name: string | null) =>
    name ? fs.stat(path.join(POSTER_DIR, name)).then(() => true, () => false) : Promise.resolve(false);

  try {
    await fs.mkdir(POSTER_DIR, { recursive: true });
    const local = await findLocalPoster(m.full, m.isSeries);

    if (local) {
      const name = `${m.id}-local.jpg`;
      if (m.current === name && (await exists(name))) return name;
      await ff(["-i", local, "-vf", "scale=360:-2", "-frames:v", "1", "-q:v", "4", path.join(POSTER_DIR, name)]);
      if (m.current && m.current !== name) await fs.rm(path.join(POSTER_DIR, m.current), { force: true });
      return name;
    }

    if (await exists(m.current)) return m.current;

    // tidak ada gambar: ambil satu frame di ~10% durasi, dipotong ke rasio poster 2:3
    const name = `${m.id}-frame.jpg`;
    const t = Math.min(Math.max(m.durationSec * 0.1, 1), 900);
    await ff([
      "-ss", String(t), "-i", m.full, "-frames:v", "1",
      "-vf", "crop='min(iw,ih*2/3)':'min(ih,iw*3/2)',scale=360:-2",
      "-q:v", "4", path.join(POSTER_DIR, name),
    ]);
    return name;
  } catch {
    return m.current; // ffmpeg tidak ada / gagal: kartu memakai placeholder berwarna
  }
}

// ---------- 5. Proses satu file ----------
async function processFile(full: string, warnings: string[]) {
  const rel = relOf(full);
  const ext = path.extname(full).toLowerCase();
  const info = parseName(rel);
  const stat = await fs.stat(full);

  // File yang ukurannya tidak berubah tidak perlu di-ffprobe lagi
  const prev = await prisma.media.findUnique({
    where: { filePath: rel },
    select: { sizeBytes: true, durationSec: true, width: true, height: true, videoCodec: true, audioCodec: true },
  });
  const meta =
    prev && prev.sizeBytes === BigInt(stat.size) && prev.durationSec > 0
      ? {
          durationSec: prev.durationSec,
          width: prev.width,
          height: prev.height,
          videoCodec: prev.videoCodec,
          audioCodec: prev.audioCodec,
        }
      : await probe(full);

  if (!meta) warnings.push(`${rel}: ffprobe gagal, durasi tidak terbaca`);
  else {
    const w = playbackWarning(MIME[ext], meta.videoCodec, meta.audioCodec);
    if (w) warnings.push(`${rel}: ${w}`);
  }

  const data = {
    ...info,
    durationSec: meta?.durationSec ?? 0,
    width: meta?.width ?? 0,
    height: meta?.height ?? 0,
    videoCodec: meta?.videoCodec ?? null,
    audioCodec: meta?.audioCodec ?? null,
    sizeBytes: BigInt(stat.size),
    mime: MIME[ext],
  };
  const saved = await prisma.media.upsert({
    where: { filePath: rel },
    update: data,
    create: { ...data, filePath: rel },
  });

  const subs = await findSubtitles(full);
  for (const s of subs) {
    await prisma.subtitle.upsert({
      where: { filePath: s.filePath },
      update: { mediaId: saved.id, language: s.language, label: s.label },
      create: { mediaId: saved.id, ...s },
    });
  }
  await prisma.subtitle.deleteMany({
    where: { mediaId: saved.id, filePath: { notIn: subs.map((s) => s.filePath) } },
  });

  const poster = await ensurePoster({
    id: saved.id,
    full,
    durationSec: data.durationSec,
    isSeries: info.type === "series",
    current: saved.posterPath,
  });
  if (poster !== saved.posterPath) {
    await prisma.media.update({ where: { id: saved.id }, data: { posterPath: poster } });
  }

  return prev ? ("updated" as const) : ("added" as const);
}

// ---------- 6. Pindai seluruh perpustakaan ----------
export async function scanLibrary() {
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const files = await walk(MEDIA_DIR);

  // hapus data contoh dari seed (Tahap 3)
  await prisma.media.deleteMany({ where: { filePath: { startsWith: "/dummy/" } } });

  let added = 0;
  let updated = 0;
  const warnings: string[] = [];

  for (const full of files) {
    try {
      if ((await processFile(full, warnings)) === "added") added++;
      else updated++;
    } catch (e) {
      warnings.push(`${relOf(full)}: gagal diproses (${e instanceof Error ? e.message : String(e)})`);
    }
  }

  // Hapus entri lokal yang filenya sudah tidak ada di disk (kecuali yang memiliki streamUrl online)
  let removed = 0;
  const existingMedia = await prisma.media.findMany({ select: { id: true, filePath: true, streamUrl: true } });
  const fileSet = new Set(files.map(relOf));

  for (const m of existingMedia) {
    if (!m.streamUrl && !fileSet.has(m.filePath)) {
      await prisma.media.delete({ where: { id: m.id } });
      removed++;
    }
  }

  const ids = new Set((await prisma.media.findMany({ select: { id: true } })).map((m) => m.id));
  for (const f of await fs.readdir(POSTER_DIR).catch(() => [] as string[])) {
    if (!ids.has(Number(f.split("-")[0]))) await fs.rm(path.join(POSTER_DIR, f), { force: true });
  }

  return { found: files.length, added, updated, removed, warnings };
}