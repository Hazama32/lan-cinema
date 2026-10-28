import { prisma } from "./prisma";
import { isFinished } from "./series";
import type { MediaDetail, Movie } from "./types";

export async function getLibrary(userId = 1, q = ""): Promise<Movie[]> {
  const term = q.trim();
  const rows = await prisma.media.findMany({
    where: term
      ? {
          OR: [
            { title: { contains: term } },
            { seriesTitle: { contains: term } },
            ...(/^\d{4}$/.test(term) ? [{ year: Number(term) }] : []),
          ],
        }
      : undefined,
    orderBy: { id: "asc" },
    include: { progress: { where: { userId } } },
  });

  return rows.map((m) => {
    const raw = m.progress[0]?.positionSec ?? 0;
    const finished = isFinished(raw, m.durationSec);
    const pos = finished ? 0 : raw;
    return {
      id: m.id,
      title: m.seriesTitle ? `${m.seriesTitle} ${m.title}` : m.title,
      type: m.type as Movie["type"],
      seriesTitle: m.seriesTitle,
      season: m.season,
      episode: m.episode,
      year: m.year,
      durationSec: m.durationSec,
      height: m.height,
      progress: pos > 0 && m.durationSec ? Math.round((pos / m.durationSec) * 100) : undefined,
      positionSec: pos,
      finished,
      watchedAt: m.progress[0]?.updatedAt.getTime() ?? 0,
      hasPoster: !!m.posterPath,
    };
  });
}

export async function getMedia(id: number, userId = 1): Promise<MediaDetail | null> {
  const m = await prisma.media.findUnique({
    where: { id },
    include: { progress: { where: { userId } } },
  });
  if (!m) return null;
  const raw = m.progress[0]?.positionSec ?? 0;
  const finished = isFinished(raw, m.durationSec);
  return {
    id: m.id,
    title: m.title,
    type: m.type as MediaDetail["type"],
    seriesTitle: m.seriesTitle,
    season: m.season,
    episode: m.episode,
    year: m.year,
    durationSec: m.durationSec,
    width: m.width,
    height: m.height,
    sizeBytes: Number(m.sizeBytes), // BigInt tidak bisa dikirim sebagai JSON
    mime: m.mime,
    videoCodec: m.videoCodec,
    audioCodec: m.audioCodec,
    filePath: m.filePath,
    positionSec: finished ? 0 : raw, // selesai -> putar dari awal
    finished,
    hasPoster: !!m.posterPath,
  };
}

export async function getEpisodes(seriesTitle: string) {
  return prisma.media.findMany({
    where: { seriesTitle },
    orderBy: [{ season: "asc" }, { episode: "asc" }],
    select: { id: true, title: true, season: true, episode: true, durationSec: true, posterPath: true },
  });
}

export async function getSubtitles(mediaId: number) {
  return prisma.subtitle.findMany({
    where: { mediaId },
    orderBy: { id: "asc" },
    select: { id: true, label: true, language: true },
  });
}