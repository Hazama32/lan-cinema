import Link from "next/link";
import MovieCard from "@/components/MovieCard";
import Navbar from "@/components/Navbar";
import { getLibrary } from "@/lib/media";
import { requireUser } from "@/lib/session";
import type { Movie } from "@/lib/types";
import { qualityLabel } from "@/lib/ui";
import { groupSeries } from "@/lib/series";

export const dynamic = "force-dynamic";

const PAGE = 24;
const SORTS = {
  baru: "Terbaru ditambahkan",
  judul: "Judul A–Z",
  tahun: "Tahun (terbaru)",
  durasi: "Durasi (terpanjang)",
} as const;
type SortKey = keyof typeof SORTS;
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

const sorters: Record<SortKey, (a: Movie, b: Movie) => number> = {
  baru: (a, b) => (b.latestId ?? b.id) - (a.latestId ?? a.id),
  judul: (a, b) => a.title.localeCompare(b.title, "id"),
  tahun: (a, b) => (b.year ?? 0) - (a.year ?? 0),
  durasi: (a, b) => b.durationSec - a.durationSec,
};

const field =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-brand";

export default async function Katalog({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const type = one(sp.type);
  const year = one(sp.year);
  const quality = one(sp.quality);
  const sort: SortKey = Object.hasOwn(SORTS, one(sp.sort)) ? (one(sp.sort) as SortKey) : "baru";

  const all = groupSeries(await getLibrary(user.id));
  const years = [...new Set(all.map((m) => m.year).filter((y): y is number => !!y))].sort((a, b) => b - a);

  const list = all
    .filter(
      (m) =>
        (!type || m.type === type) &&
        (!year || String(m.year) === year) &&
        (!quality || qualityLabel(m.height) === quality),
    )
    .sort(sorters[sort]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const cur = Math.min(Math.max(1, Number(one(sp.page)) || 1), pages);
  const shown = list.slice((cur - 1) * PAGE, cur * PAGE);

  const href = (o: Record<string, string>) => {
    const p = new URLSearchParams();
    const base: Record<string, string> = { type, year, quality, sort: sort === "baru" ? "" : sort, ...o };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/katalog?${s}` : "/katalog";
  };

  const chips = [
    { v: "", label: "Semua" },
    { v: "movie", label: "Film" },
    { v: "series", label: "Series" },
  ];

  return (
    <>
      <Navbar user={user} q="" />
      <main className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <header className="mt-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-brand">Katalog LAN Cinema</p>
            <h1 className="mt-1 text-3xl font-black sm:text-5xl">
              Katalog & Eksplorasi <span className="text-brand">Film</span>
            </h1>
            <p className="mt-2 text-zinc-400">Semua koleksi di server lokal Anda, tanpa internet.</p>
          </div>
          <div className="flex gap-6 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Total judul</p>
              <p className="text-2xl font-bold">{all.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Kualitas 4K</p>
              <p className="text-2xl font-bold">{all.filter((m) => qualityLabel(m.height) === "4K").length}</p>
            </div>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <Link
                key={c.v}
                href={href({ type: c.v })}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                  type === c.v ? "bg-brand" : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {c.label}
              </Link>
            ))}
          </div>

          <form action="/katalog" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {type && <input type="hidden" name="type" value={type} />}
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Tahun rilis
              <select name="year" defaultValue={year} className={`${field} mt-1 normal-case tracking-normal`}>
                <option value="">Semua tahun</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Kualitas visual
              <select name="quality" defaultValue={quality} className={`${field} mt-1 normal-case tracking-normal`}>
                <option value="">Semua</option>
                <option value="4K">4K</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
                <option value="360p">360p</option>
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Urutkan
              <select name="sort" defaultValue={sort} className={`${field} mt-1 normal-case tracking-normal`}>
                {Object.entries(SORTS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2 lg:col-span-2">
              <button className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold hover:opacity-90">Terapkan</button>
              <Link href="/katalog" className="rounded-lg border border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-800">
                Reset
              </Link>
            </div>
          </form>

          <p className="mt-4 text-xs text-zinc-500">
            {list.length === 0
              ? "Tidak ada judul yang cocok."
              : `Menampilkan ${(cur - 1) * PAGE + 1}–${(cur - 1) * PAGE + shown.length} dari ${list.length} judul`}
          </p>
        </section>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {shown.map((m) => (
            <MovieCard key={m.id} movie={m} />
          ))}
        </div>

        {pages > 1 && (
          <nav className="mt-8 flex items-center justify-center gap-3 text-sm">
            {cur > 1 && (
              <Link href={href({ page: String(cur - 1) })} className="rounded-lg border border-zinc-700 px-4 py-2 hover:bg-zinc-800">
                ← Sebelumnya
              </Link>
            )}
            <span className="text-zinc-400">Halaman {cur} dari {pages}</span>
            {cur < pages && (
              <Link href={href({ page: String(cur + 1) })} className="rounded-lg border border-zinc-700 px-4 py-2 hover:bg-zinc-800">
                Berikutnya →
              </Link>
            )}
          </nav>
        )}
      </main>
    </>
  );
}