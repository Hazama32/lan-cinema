import type { Movie } from "./types";

// Watched >= 95% is considered finished (same rule used in /api/progress)
export const FINISHED_RATIO = 0.95;
export const isFinished = (pos: number, dur: number) => dur > 0 && pos >= dur * FINISHED_RATIO;

/** Whether the content type has episodes (series or anime) */
export const isEpisodic = (type: string) => type === "series" || type === "anime";

export const seriesKey = (m: Movie) =>
  isEpisodic(m.type) && m.seriesTitle ? `s:${m.seriesTitle}` : `m:${m.id}`;

const order = (a: Movie, b: Movie) =>
  (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0) || a.id - b.id;

// "Continue S01 E02"; if episode has no number, just "Continue"
const label = (verb: string, m: Movie) =>
  m.episode === null
    ? verb
    : `${verb} S${String(m.season ?? 1).padStart(2, "0")} E${String(m.episode).padStart(2, "0")}`;

const newest = (l: Movie[]) => l.reduce((a, b) => (b.watchedAt > a.watchedAt ? b : a));

// Episode to open when a series/anime card is clicked:
//  1) the most recently half-watched episode,
//  2) if none: the first unwatched episode after the last finished one,
//  3) if all finished: first episode ("Watch again"),
//  4) if never watched: first episode.
export function pickTarget(eps: Movie[]) {
  const sorted = [...eps].sort(order);

  const inProgress = sorted.filter((e) => e.progress !== undefined);
  if (inProgress.length) {
    const e = newest(inProgress);
    return { episode: e, note: label("Continue", e) };
  }

  const done = sorted.filter((e) => e.finished);
  if (done.length) {
    const last = newest(done);
    const after = sorted.slice(sorted.indexOf(last) + 1).find((e) => !e.finished);
    const next = after ?? sorted.find((e) => !e.finished);
    return next
      ? { episode: next, note: label("Next", next) }
      : { episode: sorted[0], note: "Watch again" };
  }

  return { episode: sorted[0], note: label("Start", sorted[0]) };
}

// One card per movie / series / anime. Output order = first occurrence order in `items`.
export function groupSeries(items: Movie[]): Movie[] {
  const buckets = new Map<string, Movie[]>();
  for (const m of items) {
    const k = seriesKey(m);
    const b = buckets.get(k);
    if (b) b.push(m);
    else buckets.set(k, [m]);
  }

  return [...buckets.values()].map((eps) => {
    const first = eps[0];
    if (!isEpisodic(first.type) || !first.seriesTitle) return first; // regular movie

    const sorted = [...eps].sort(order);
    const { episode, note } = pickTarget(sorted);
    const withPoster = sorted.find((e) => e.hasPoster);
    return {
      ...episode,
      title: first.seriesTitle,
      year: sorted.find((e) => e.year)?.year ?? null,
      height: Math.max(...sorted.map((e) => e.height)),
      watchedAt: Math.max(...sorted.map((e) => e.watchedAt)),
      hasPoster: !!withPoster,
      posterId: withPoster?.id ?? episode.id,
      latestId: Math.max(...sorted.map((e) => e.id)), // for "Recently added" sorting
      episodeCount: sorted.length,
      seasonCount: new Set(sorted.map((e) => e.season ?? 0)).size,
      note,
    };
  });
}