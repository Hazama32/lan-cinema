import Link from "next/link";
import ContinueCard from "@/components/ContinueCard";
import Hero from "@/components/Hero";
import MovieCard from "@/components/MovieCard";
import Navbar from "@/components/Navbar";
import Rail from "@/components/Rail";
import { getLibrary } from "@/lib/media";
import { groupSeries, seriesKey } from "@/lib/series";
import { requireUser } from "@/lib/session";
import type { Movie } from "@/lib/types";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "series", label: "Series" },
  { value: "anime", label: "Anime" },
] as const;

function Grid({ items }: { items: Movie[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((m) => (
        <MovieCard key={m.id} movie={m} />
      ))}
    </div>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; type?: string | string[] }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const rawType = typeof sp.type === "string" ? sp.type : "all";
  const type = ["all", "movie", "series", "anime"].includes(rawType) ? rawType : "all";

  const all = await getLibrary(user.id, q); // one row per file (per episode)
  const titles = groupSeries(all); // one card per movie / series / anime
  const list = type === "all" ? titles : titles.filter((m) => m.type === type);

  // Continue watching: per episode, but 1 card per series/anime (newest)
  const seen = new Set<string>();
  const continueWatching = all
    .filter((m) => m.progress !== undefined)
    .sort((a, b) => b.watchedAt - a.watchedAt)
    .filter((m) => {
      const k = seriesKey(m);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  const newestFirst = [...all].reverse(); // largest id = most recently added
  const recent = groupSeries(newestFirst).slice(0, 12);
  const searching = q !== "";

  const heroMovie =
    continueWatching.find((m) => m.hasPoster) ??
    newestFirst.find((m) => m.hasPoster) ??
    continueWatching[0] ??
    newestFirst[0];
  const heroLabel = heroMovie?.progress !== undefined ? "Continue Watching" : "Recently Added";

  const movieCount = all.filter((m) => m.type === "movie").length;
  const seriesCount = new Set(all.filter((m) => m.type === "series").map((m) => m.seriesTitle)).size;
  const animeCount = new Set(all.filter((m) => m.type === "anime").map((m) => m.seriesTitle)).size;
  const hours = Math.round(all.reduce((s, m) => s + m.durationSec, 0) / 3600);

  return (
    <>
      <Navbar user={user} q={q} />
      <main className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        {all.length === 0 ? (
          <p className="mt-16 text-center text-zinc-400">
            {searching
              ? `No results found for "${q}".`
              : "No media found. Place video files in the media/ folder and click Scan."}
          </p>
        ) : searching ? (
          <section className="mt-8">
            <h2 className="mb-4 text-xl font-bold">
              Results for “{q}”{" "}
              <span className="text-sm font-normal text-zinc-500">({titles.length})</span>
            </h2>
            <Grid items={titles} />
          </section>
        ) : (
          <>
            {heroMovie && (
              <div className="mt-6">
                <Hero movie={heroMovie} label={heroLabel} />
              </div>
            )}

            <p className="mt-4 text-xs text-zinc-500">
              {movieCount} movies • {seriesCount} series • {animeCount} anime • {hours} hours of local streaming
            </p>

            {continueWatching.length > 0 && (
              <Rail eyebrow="Your Activity" title={`Continue Watching for ${user.name}`}>
                {continueWatching.map((m) => (
                  <ContinueCard key={m.id} movie={m} />
                ))}
              </Rail>
            )}

            {titles.length > 6 && (
              <Rail eyebrow="New Releases" title="Recently Added">
                {recent.map((m) => (
                  <div key={m.id} className="w-40 shrink-0 snap-start sm:w-44">
                    <MovieCard movie={m} />
                  </div>
                ))}
              </Rail>
            )}

            <section className="mt-10">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold sm:text-2xl">Library</h2>
                <div className="flex gap-2">
                  {TABS.map((t) => (
                    <Link
                      key={t.value}
                      href={t.value === "all" ? "/" : `/?type=${t.value}`}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                        type === t.value
                          ? "bg-white text-black"
                          : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      {t.label}
                    </Link>
                  ))}
                </div>
              </div>
              {list.length > 0 ? (
                <Grid items={list} />
              ) : (
                <p className="py-10 text-center text-zinc-500">No items found in this category.</p>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-zinc-800 py-6 text-center text-xs text-zinc-500">
        LAN CINEMA • Open-source personal streaming •{" "}
        <Link href="/connect" className="underline hover:text-zinc-300">
          Connect Phone
        </Link>
      </footer>
    </>
  );
}