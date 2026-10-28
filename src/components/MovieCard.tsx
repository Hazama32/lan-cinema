import Link from "next/link";
import { formatDuration } from "@/lib/format";
import { qualityLabel } from "@/lib/ui";
import type { Movie } from "@/lib/types";
import Poster from "./Poster";
import { PlayIcon } from "./icons";

const badge = "absolute rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold tracking-wider";

export default function MovieCard({ movie }: { movie: Movie }) {
  const quality = qualityLabel(movie.height);
  const isGroup = movie.episodeCount !== undefined; // series/anime card from groupSeries()
  const info = isGroup
    ? [movie.year, `${movie.seasonCount} seasons`, `${movie.episodeCount} episodes`]
    : [movie.year, formatDuration(movie.durationSec)];

  const typeBadge =
    movie.type === "anime" ? "ANIME" : movie.type === "series" ? "SERIES" : null;

  return (
    <Link
      href={`/movie/${movie.id}`}
      className="group block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition hover:-translate-y-1 hover:border-zinc-600"
    >
      <div className="relative">
        <Poster id={movie.posterId ?? movie.id} title={movie.title} hasPoster={movie.hasPoster} />
        {typeBadge && <span className={`${badge} left-2 top-2`}>{typeBadge}</span>}
        {quality && <span className={`${badge} right-2 top-2`}>{quality}</span>}
        {movie.finished && (
          <span className={`${badge} bottom-2 left-2 text-green-400`}>✓ COMPLETED</span>
        )}
        <span className="absolute bottom-2 right-2 grid size-9 place-items-center rounded-full bg-brand opacity-0 transition group-hover:opacity-100">
          <PlayIcon className="size-4" />
        </span>
      </div>
      {movie.progress !== undefined && (
        <div className="h-1 bg-zinc-700">
          <div className="h-1 bg-brand" style={{ width: `${movie.progress}%` }} />
        </div>
      )}
      <div className="p-3">
        {movie.hasPoster && <p className="truncate text-sm font-semibold">{movie.title}</p>}
        <p className="text-xs text-zinc-400">{info.filter(Boolean).join(" • ")}</p>
        {movie.note && <p className="mt-0.5 truncate text-xs font-semibold text-brand">{movie.note}</p>}
      </div>
    </Link>
  );
}