import Link from "next/link";
import { formatClock, formatDuration, hueOf, typeLabel } from "@/lib/format";
import { qualityLabel } from "@/lib/ui";
import type { Movie } from "@/lib/types";
import WatchTogetherButton from "./WatchTogetherButton";
import { InfoIcon, PlayIcon } from "./icons";

const chip = "rounded border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] font-bold tracking-wider";

export default function Hero({ movie, label }: { movie: Movie; label: string }) {
  const resume = movie.positionSec > 10;
  const playHref = `/watch/${movie.id}${resume ? `?t=${Math.floor(movie.positionSec)}` : ""}`;
  const quality = qualityLabel(movie.height);
  const meta = [movie.year, formatDuration(movie.durationSec)].filter(Boolean).join(" • ");
  const episode = movie.seriesTitle ? movie.title.slice(movie.seriesTitle.length).trim() : "";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      {movie.hasPoster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/poster/${movie.id}`}
          alt=""
          className="absolute inset-0 size-full scale-125 object-cover opacity-40 blur-3xl"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 70% 30%, hsl(${hueOf(movie.title)} 60% 25%), transparent 70%)`,
          }}
        />
      )}
      <div className="absolute inset-0 bg-linear-to-r from-zinc-950 via-zinc-950/70 to-transparent" />

      <div className="relative flex items-center gap-8 p-6 sm:p-10 lg:p-14">
        <div className="max-w-2xl flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand">{label}</p>
          <h1 className="mt-3 text-4xl font-black uppercase leading-none tracking-tight sm:text-5xl lg:text-6xl">
            {movie.seriesTitle ?? movie.title}
          </h1>
          {episode && <p className="mt-2 text-lg text-zinc-300">{episode}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
            <span className={chip}>{typeLabel(movie.type)}</span>
            {quality && <span className={chip}>{quality}</span>}
            {meta && <span>{meta}</span>}
          </div>
          {resume && (
            <p className="mt-3 text-sm text-zinc-400">
              Last stopped at {formatClock(movie.positionSec)} ({movie.progress}% completed)
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3 [&_button]:rounded-lg [&_button]:px-5 [&_button]:py-3 [&_button]:font-semibold">
            <Link
              href={playHref}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 font-bold hover:opacity-90"
            >
              <PlayIcon />
              {resume ? `Resume ${formatClock(movie.positionSec)}` : "Watch Now"}
            </Link>
            <WatchTogetherButton mediaId={movie.id} />
            <Link
              href={`/movie/${movie.id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 px-5 py-3 font-semibold hover:bg-white/10"
            >
              <InfoIcon />
              Overview
            </Link>
          </div>
        </div>

        {movie.hasPoster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/poster/${movie.id}`}
            alt={movie.title}
            className="hidden w-48 shrink-0 rounded-xl shadow-2xl ring-1 ring-white/10 md:block lg:w-56"
          />
        )}
      </div>
    </section>
  );
}