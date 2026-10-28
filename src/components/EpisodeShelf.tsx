"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDuration, hueOf } from "@/lib/format";

export type Ep = {
  id: number;
  title: string;
  season: number | null;
  episode: number | null;
  durationSec: number;
  hasPoster: boolean;
};

export default function EpisodeShelf({
  episodes,
  currentId,
  inRoom,
  basePath = "/watch",
  nowLabel = "SEDANG DIPUTAR",
}: {
  episodes: Ep[];
  currentId: number;
  inRoom: boolean;
  basePath?: string;
  nowLabel?: string;
}) {
  const idx = episodes.findIndex((e) => e.id === currentId);
  const nextId = idx >= 0 ? episodes[idx + 1]?.id : undefined;
  const seasons = [...new Set(episodes.map((e) => e.season ?? 0))].sort((a, b) => a - b);
  const [season, setSeason] = useState(episodes[idx]?.season ?? seasons[0] ?? 0);
  const list = episodes.filter((e) => (e.season ?? 0) === season);

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold">Episode</h2>
        <select
          value={season}
          onChange={(e) => setSeason(Number(e.target.value))}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-brand"
        >
          {seasons.map((s) => (
            <option key={s} value={s}>
              {s ? `Season ${s}` : "Lainnya"}
            </option>
          ))}
        </select>
        {inRoom && (
          <span className="text-xs text-zinc-500">Pindah episode akan keluar dari room ini.</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((e) => {
          const now = e.id === currentId;
          const next = e.id === nextId;
          return (
            <Link
              key={e.id}
              href={`${basePath}/${e.id}`}
              className={`group block overflow-hidden rounded-xl border bg-zinc-900 ${
                now ? "border-brand" : "border-zinc-800 hover:border-zinc-600"
              }`}
            >
              <div
                className="relative aspect-video overflow-hidden"
                style={e.hasPoster ? undefined : { backgroundColor: `hsl(${hueOf(e.title)} 45% 28%)` }}
              >
                {e.hasPoster && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/poster/${e.id}`}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover object-[50%_25%] transition duration-300 group-hover:scale-105"
                  />
                )}
                {(now || next) && (
                  <span
                    className={`absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${
                      now ? "bg-brand" : "bg-black/70"
                    }`}
                  >
                    {now ? nowLabel : "SELANJUTNYA"}
                  </span>
                )}
                <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px]">
                  {formatDuration(e.durationSec)}
                </span>
              </div>
              <div className="p-3">
                <p className="text-xs text-zinc-400">Episode {e.episode ?? "?"}</p>
                <p className="truncate font-semibold">{e.title}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}