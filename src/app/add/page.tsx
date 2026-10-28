"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

interface TmdbItem {
  id: number;
  title?: string;
  name?: string;
  media_type: "movie" | "tv";
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string;
}

export default function AddMediaPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<TmdbItem | null>(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState("movie");
  const [seriesTitle, setSeriesTitle] = useState("");
  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  const [year, setYear] = useState("");
  const [description, setDescription] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    try {
      const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.results) {
        setResults(data.results.filter((r: TmdbItem) => r.media_type === "movie" || r.media_type === "tv"));
      } else {
        setResults([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mencari TMDB");
    } finally {
      setSearching(false);
    }
  }

  function handleSelect(item: TmdbItem) {
    setSelected(item);
    const itemTitle = item.title || item.name || "";
    const releaseDate = item.release_date || item.first_air_date || "";
    const itemYear = releaseDate ? new Date(releaseDate).getFullYear() : "";
    const isTv = item.media_type === "tv";

    setTitle(itemTitle);
    setType(isTv ? "series" : "movie");
    setSeriesTitle(isTv ? itemTitle : "");
    setYear(itemYear ? String(itemYear) : "");
    setDescription(item.overview || "");
    setPosterUrl(item.poster_path || "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !streamUrl) {
      setError("Judul dan Stream URL wajib diisi.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/media/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          seriesTitle: type === "series" ? seriesTitle || title : null,
          season: type === "series" ? Number(season) : null,
          episode: type === "series" ? Number(episode) : null,
          year: year ? Number(year) : null,
          description,
          streamUrl,
          posterUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");

      router.push(`/katalog`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Navbar user={{ name: "Owner", isOwner: true }} q="" />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold">Tambah Film / Series dari TMDB</h1>
        <p className="mt-1 text-sm text-zinc-400">Cari dari TMDB atau masukkan tautan stream online (MP4 / HLS).</p>

        {error && <div className="mt-4 rounded bg-red-950 p-3 text-sm text-red-200 border border-red-800">{error}</div>}

        <form onSubmit={handleSearch} className="mt-6 flex gap-2">
          <input
            type="text" placeholder="Cari judul film/series..." value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 focus:border-brand focus:outline-none"
          />
          <button type="submit" disabled={searching} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white">
            {searching ? "Mencari..." : "Cari TMDB"}
          </button>
        </form>

        {results.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {results.map((r) => (
              <div
                key={r.id} onClick={() => handleSelect(r)}
                className={`cursor-pointer rounded-lg border bg-zinc-900 overflow-hidden hover:scale-105 transition ${selected?.id === r.id ? "border-brand ring-2 ring-brand" : "border-zinc-800"}`}
              >
                {r.poster_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://image.tmdb.org/t/p/w300${r.poster_path}`}
                    alt={r.title || r.name || "Poster"}
                    loading="lazy"
                    className="aspect-2/3 w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-2/3 w-full items-center justify-center bg-zinc-800 text-xs">No Poster</div>
                )}
                <div className="p-2">
                  <p className="truncate text-xs font-semibold">{r.title || r.name}</p>
                  <p className="text-[10px] text-zinc-400 capitalize">{r.media_type}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h2 className="text-lg font-bold">Detail Media & Stream URL</h2>
          <div>
            <label className="block text-xs font-medium text-zinc-300">Tipe</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-100">
              <option value="movie">Film</option>
              <option value="series">Series / Anime</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300">Judul</label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300">Tahun</label>
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-100" />
            </div>
          </div>
          {type === "series" && (
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-xs font-medium text-zinc-300">Series Title</label><input type="text" value={seriesTitle} onChange={(e) => setSeriesTitle(e.target.value)} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-100" /></div>
              <div><label className="block text-xs font-medium text-zinc-300">Season</label><input type="number" value={season} onChange={(e) => setSeason(e.target.value)} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-100" /></div>
              <div><label className="block text-xs font-medium text-zinc-300">Episode</label><input type="number" value={episode} onChange={(e) => setEpisode(e.target.value)} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-100" /></div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-zinc-300">Stream URL (MP4 / HLS / M3U8)</label>
            <input type="url" required value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="https://..." className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-100" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300">Poster URL / Path</label>
            <input type="text" value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-100" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300">Deskripsi</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-100" />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded bg-brand py-3 text-sm font-bold text-white hover:bg-brand/90">
            {loading ? "Menyimpan..." : "Tambah ke Katalog"}
          </button>
        </form>
      </main>
    </div>
  );
}

