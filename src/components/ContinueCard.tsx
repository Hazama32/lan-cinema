import Link from "next/link";
import { formatClock, hueOf } from "@/lib/format";
import type { Movie } from "@/lib/types";
import { PlayIcon } from "./icons";

export default function ContinueCard({ movie }: { movie: Movie }) {
  return (
    <Link
      href={`/watch/${movie.id}?t=${Math.floor(movie.positionSec)}`}
      className="group block w-72 shrink-0 snap-start overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition hover:border-zinc-600 sm:w-80"
    >
      <div
        className="relative aspect-video overflow-hidden"
        style={movie.hasPoster ? undefined : { backgroundColor: `hsl(${hueOf(movie.title)} 45% 28%)` }}
      >
        {movie.hasPoster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/poster/${movie.id}`}
            alt=""
            className="size-full object-cover object-[50%_25%] transition duration-300 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />
        <span className="absolute bottom-4 right-3 grid size-10 place-items-center rounded-full bg-brand opacity-0 transition group-hover:opacity-100">
          <PlayIcon />
        </span>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
          <div className="h-full bg-brand" style={{ width: `${movie.progress ?? 0}%` }} />
        </div>
      </div>
      <div className="p-3">
        <p className="truncate font-semibold">{movie.title}</p>
        <p className="mt-0.5 text-xs text-zinc-400">
          {formatClock(movie.positionSec)} dari {formatClock(movie.durationSec)} • {movie.progress}% selesai
        </p>
      </div>
    </Link>
  );
}