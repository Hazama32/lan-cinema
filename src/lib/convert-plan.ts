// Logika murni (tanpa Node/Prisma): memilih cara konversi dan menyusun argumen ffmpeg.
export type FfStream = {
  index: number;
  codec_type?: string;
  codec_name?: string;
  pix_fmt?: string;
  height?: number;
  color_transfer?: string;
  tags?: { language?: string };
  disposition?: { default?: number; attached_pic?: number };
};

export type Mode = "none" | "copy" | "audio" | "video";

export const MODE_LABEL: Record<Mode, string> = {
  none: "Sudah kompatibel",
  copy: "Cepat · hanya dibungkus ulang ke MP4",
  audio: "Cepat · hanya audio diubah ke AAC",
  video: "Lambat · video dikodekan ulang ke H.264",
};

export type JobStatus = "queued" | "running" | "done" | "error" | "canceled";
export type Job = {
  id: number; // id Media
  title: string;
  status: JobStatus;
  mode: Mode | null;
  pct: number;
  speed: number;
  etaSec: number | null;
  message: string;
};

// Perkiraan dari data di database (tanpa membuka file). Keputusan akhir diambil saat konversi.
export function estimateMode(mime: string, v: string | null, a: string | null): Mode {
  if (mime === "video/webm") return "none";
  if (v === null) return mime === "video/mp4" ? "none" : "copy"; // codec tak diketahui
  if (v !== "h264") return "video";
  if (a && a !== "aac") return "audio";
  return mime === "video/mp4" ? "none" : "copy";
}

const GOOD_PIX = new Set(["yuv420p", "yuvj420p"]); // H.264 8-bit; 10-bit (Hi10P) tidak diputar browser
const TEXT_SUBS = new Set(["subrip", "srt", "ass", "ssa", "mov_text", "webvtt", "text"]);
const LANG: Record<string, string> = { ind: "id", id: "id", eng: "en", en: "en" };
const MAX_HEIGHT = 1080;

export type Plan = {
  mode: Mode;
  video: FfStream;
  audio: FfStream | null;
  subs: { index: number; tag: string }[];
  hdr: boolean;
  scale: boolean;
};

export function makePlan(streams: FfStream[], container: "mp4" | "other"): Plan | null {
  const video = streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  if (!video) return null;

  const audios = streams.filter((s) => s.codec_type === "audio");
  const audio = audios.find((s) => s.disposition?.default === 1) ?? audios[0] ?? null;

  const videoOk = video.codec_name === "h264" && (!video.pix_fmt || GOOD_PIX.has(video.pix_fmt));
  const audioOk = !audio || audio.codec_name === "aac";
  const mode: Mode = !videoOk ? "video" : !audioOk ? "audio" : container === "mp4" ? "none" : "copy";

  const seen = new Map<string, number>();
  const subs = streams
    .filter((s) => s.codec_type === "subtitle" && TEXT_SUBS.has(s.codec_name ?? ""))
    .slice(0, 6)
    .map((s, i) => {
      const lang = (s.tags?.language ?? "").toLowerCase();
      let tag = LANG[lang] ?? (lang && lang !== "und" ? lang : `sub${i + 1}`);
      const n = (seen.get(tag) ?? 0) + 1;
      seen.set(tag, n);
      if (n > 1) tag += `.${n}`;
      return { index: s.index, tag };
    });

  return {
    mode,
    video,
    audio,
    subs,
    hdr: ["smpte2084", "arib-std-b67"].includes(video.color_transfer ?? ""),
    scale: (video.height ?? 0) > MAX_HEIGHT,
  };
}

export function mainArgs(plan: Plan, input: string, output: string): string[] {
  const a = ["-hide_banner", "-nostdin", "-y", "-i", input, "-map", `0:${plan.video.index}`];
  if (plan.audio) a.push("-map", `0:${plan.audio.index}`);
  a.push("-map_metadata", "-1", "-map_chapters", "-1");

  if (plan.mode === "video") {
    a.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-profile:v", "high");
    if (plan.scale) a.push("-vf", `scale=-2:${MAX_HEIGHT}`);
  } else {
    a.push("-c:v", "copy");
  }

  if (plan.audio) {
    if (plan.audio.codec_name === "aac") a.push("-c:a", "copy");
    else a.push("-c:a", "aac", "-b:a", "192k", "-ac", "2");
  }

  a.push("-movflags", "+faststart", "-progress", "pipe:1", "-nostats", "-f", "mp4", output);
  return a;
}

export function subArgs(input: string, index: number, output: string): string[] {
  return ["-hide_banner", "-nostdin", "-y", "-i", input, "-map", `0:${index}`, "-c:s", "srt", "-f", "srt", output];
}