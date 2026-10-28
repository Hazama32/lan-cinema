export const hueOf = (s: string) =>
  [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

export function formatDuration(sec: number) {
  if (!sec) return "?";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatClock(sec: number) {
  const s = Math.floor(sec);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

export function formatSize(bytes: number) {
  return bytes >= 1e9
    ? `${(bytes / 1e9).toFixed(2)} GB`
    : `${Math.round(bytes / 1e6)} MB`;
}

// Playback compatibility warning (MP4 H.264 + AAC is the safest)
export function playbackWarning(mime: string, v: string | null, a: string | null) {
  if (mime === "video/webm") return null;
  if (mime === "video/x-matroska")
    return "MKV format is not supported by most browsers (especially on iPhone). Convert to MP4 first.";
  if ((v && v !== "h264") || (a && a !== "aac"))
    return `Codec ${v ?? "?"}/${a ?? "?"} may not play on all devices (ideal: H.264 + AAC).`;
  return null;
}

/** User-friendly label for content type */
export function typeLabel(type: string) {
  switch (type) {
    case "movie": return "MOVIE";
    case "series": return "SERIES";
    case "anime": return "ANIME";
    default: return type.toUpperCase();
  }
}