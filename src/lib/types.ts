export type ContentType = "movie" | "series" | "anime";

export type Movie = {
  id: number;
  title: string; // single episode: "Attack on Titan S01E01"; series card (from groupSeries): "Attack on Titan"
  type: ContentType;
  seriesTitle: string | null;
  season: number | null;
  episode: number | null;
  year: number | null;
  durationSec: number;
  height: number;
  progress?: number; // 0–100; empty if not started OR already finished
  positionSec: number; // 0 if already finished
  finished: boolean;
  watchedAt: number; // ms; 0 = never watched
  hasPoster: boolean;
  // only populated on series/anime cards from groupSeries()
  posterId?: number; // episode id whose poster is used
  latestId?: number; // latest episode id
  episodeCount?: number;
  seasonCount?: number;
  note?: string; // "Continue S01 E02", etc.
};

export type MediaDetail = {
  id: number;
  title: string;
  type: ContentType;
  seriesTitle: string | null;
  season: number | null;
  episode: number | null;
  year: number | null;
  durationSec: number;
  width: number;
  height: number;
  sizeBytes: number; // BigInt from database converted to number
  mime: string;
  videoCodec: string | null;
  audioCodec: string | null;
  filePath: string;
  positionSec: number; // 0 if already finished
  finished: boolean;
  hasPoster: boolean;
};

export type SubtitleTrack = { id: number; label: string; language: string };