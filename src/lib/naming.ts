const pad = (n: number) => String(n).padStart(2, "0");

export const clean = (s: string) =>
  s.replace(/[._]+/g, " ").replace(/\s+/g, " ").replace(/^[\s-]+|[\s-]+$/g, "");

// Strip site/group tags at the beginning: "[SubGroup] - Title", "[YTS.MX] Title"
// (tags containing a year, e.g. "[2010]", are kept)
const TAG = /^\s*\[(?!(?:19|20)\d{2}\])[^\]]*\]\s*[-–_.]*\s*/;
function stripTags(s: string) {
  let prev: string;
  do {
    prev = s;
    s = s.replace(TAG, "");
  } while (s !== prev);
  return s;
}

// Release tags that mark end of title: 1080p, BluRay, x264, ...
const QUALITY =
  /[\s._[(-]*(2160p|1080p|720p|480p|4k|uhd|blu-?ray|brrip|bdrip|web-?rip|web-?dl|hdrip|hdtv|dvdrip|x26[45]|h\.?26[45]|hevc|10bit|remux)\b.*$/i;

function titleAndYear(raw: string) {
  let year: number | null = null;
  let s = stripTags(raw);

  const paren = s.match(/[(\[](19|20)\d{2}[)\]]/);
  if (paren) {
    year = Number(paren[0].slice(1, 5));
    s = s.slice(0, paren.index);
  } else {
    // year without brackets: take the LAST one and not at the beginning ("2001.A.Space.Odyssey.1968")
    const hits = [...s.matchAll(/(?<=[\s._-])((?:19|20)\d{2})(?=[\s._-]|$)/g)].filter(
      (m) => (m.index ?? 0) > 0,
    );
    const last = hits.at(-1);
    if (last) {
      year = Number(last[1]);
      s = s.slice(0, last.index ?? s.length);
    }
  }
  return { title: clean(s.replace(QUALITY, "")), year };
}

// ---------- Series & Anime ----------
const GENERIC = new Set([
  "series", "serial", "movies", "film", "films", "tv", "shows", "tv shows",
  "anime", "drama", "dramas", "kartun", "cartoon", "cartoons",
]);
// Files inside SUBFOLDERS of these directories are treated as episodes even without markers
// ("Series/Show Name/05.mkv"). Files directly in these folders are still treated as movies.
const ANIME_ROOT = /^anime$/i;
const SERIES_ROOT = /^(series|serial|tv|tv shows|shows|drama|dramas|anime|kartun|cartoons?)$/i;
const MOVIE_ROOT = /^(movies?|film|films|bioskop)$/i;
const SEASON_DIR = /^(?:season|musim|seri|s)[\s._-]*(\d+)$/i;
// "Show Name S02", "Show Name Season 2", "Show Name Complete 1080p"
const SEASON_TAIL =
  /[\s._-]+(?:(?:season|musim|s)[\s._-]*(\d{1,2})\b|(?:complete|lengkap|batch)\b).*$/i;
const SEASON_END = /(?:^|[\s._-])(?:season|musim|s)[\s._-]*(\d{1,2})[\s._-]*$/i;

type Ep = { season: number | null; episode: number; index: number; weak: boolean };

// Mencari penanda episode di nama file. "weak" = hanya "Episode 5"/"EP05"/"E05" (tanpa musim),
// lebih mungkin salah kenal, jadi diabaikan untuk file di folder Movies/Film.
function findEpisode(base: string): Ep | null {
  let m = base.match(/S(\d{1,2})[\s._-]?E(\d{1,3})/i); // S01E02, S01.E02, S1 E2
  if (m) return { season: Number(m[1]), episode: Number(m[2]), index: m.index ?? 0, weak: false };

  m = base.match(/\b(\d{1,2})x(\d{2,3})\b/i); // 1x02
  if (m) return { season: Number(m[1]), episode: Number(m[2]), index: m.index ?? 0, weak: false };

  m = base.match(/\b(?:episode|episod|eps|ep|e)[\s._-]*(\d{1,3})\b/i); // Episode 5, EP05, E5
  if (m) return { season: null, episode: Number(m[1]), index: m.index ?? 0, weak: true };

  return null;
}

// Angka terakhir di nama, mis. "Nama - 04 [1080p]" -> 4, "05" -> 5. Tahun tidak dihitung.
function trailingNumber(base: string) {
  const s = stripTags(base)
    .replace(QUALITY, "")
    .replace(/[(\[]\s*(?:19|20)\d{2}\s*[)\]]/g, " ")
    .replace(/\[[^\]]*\]/g, " ");
  const m = s.match(/(?:^|[\s._-])(\d{1,3})(?=[\s._-]*$)/);
  return m ? Number(m[1]) : null;
}

function folderInfo(folder: string) {
  const t = titleAndYear(folder);
  const m = t.title.match(SEASON_TAIL);
  return {
    title: m ? clean(t.title.slice(0, m.index)) : t.title,
    year: t.year,
    season: m?.[1] ? Number(m[1]) : null,
  };
}

export function parseName(rel: string) {
  const parts = rel.split("/");
  const base = parts[parts.length - 1].replace(/\.[^.]+$/, "");

  // folder judul = folder terdekat yang BUKAN "Season 1"; nomor musimnya dicatat
  const dirs = parts.slice(0, -1);
  let dirSeason: number | null = null;
  while (dirs.length) {
    const m = dirs[dirs.length - 1].match(SEASON_DIR);
    if (!m) break;
    dirSeason ??= Number(m[1]);
    dirs.pop();
  }
  const folder = dirs[dirs.length - 1] ?? "";

  const rootAt = dirs.findIndex((d) => SERIES_ROOT.test(d));
  const inSeriesFolder = rootAt >= 0 && rootAt < dirs.length - 1;
  const inAnimeFolder = dirs.some((d) => ANIME_ROOT.test(d));
  const inMovies = dirs.some((d) => MOVIE_ROOT.test(d));

  let ep = findEpisode(base);
  if (ep?.weak && inMovies) ep = null;

  if (ep || inSeriesFolder) {
    let head = ep ? base.slice(0, ep.index) : "";
    let season = ep?.season ?? null;
    const st = head.match(SEASON_END); // "Show Name Season 2 - Episode 3"
    if (st) {
      season ??= Number(st[1]);
      head = head.slice(0, st.index);
    }

    const fromFolder = GENERIC.has(folder.toLowerCase()) ? null : folderInfo(folder);
    const fromName = titleAndYear(head);
    season = season ?? dirSeason ?? fromFolder?.season ?? 1;
    const episode = ep ? ep.episode : trailingNumber(base);

    // Content in the Anime/ folder is typed as "anime" instead of "series"
    const contentType = inAnimeFolder ? ("anime" as const) : ("series" as const);

    return {
      type: contentType,
      title: episode !== null ? `S${pad(season)}E${pad(episode)}` : titleAndYear(base).title || clean(base),
      seriesTitle: fromFolder?.title || fromName.title || "Unknown",
      season,
      episode,
      year: fromFolder?.year ?? fromName.year,
    };
  }

  const t = titleAndYear(base);
  return {
    type: "movie" as const,
    title: t.title || clean(base),
    seriesTitle: null,
    season: null,
    episode: null,
    year: t.year,
  };
}