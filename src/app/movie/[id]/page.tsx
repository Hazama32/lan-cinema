import Link from "next/link";
import { notFound } from "next/navigation";
import EpisodeShelf from "@/components/EpisodeShelf";
import MovieCard from "@/components/MovieCard";
import Navbar from "@/components/Navbar";
import Poster from "@/components/Poster";
import Rail from "@/components/Rail";
import WatchTogetherButton from "@/components/WatchTogetherButton";
import { PlayIcon } from "@/components/icons";
import { formatClock, formatDuration, formatSize, hueOf, playbackWarning } from "@/lib/format";
import { getEpisodes, getLibrary, getMedia, getSubtitles } from "@/lib/media";
import { requireUser } from "@/lib/session";
import type { Movie } from "@/lib/types";
import { qualityLabel } from "@/lib/ui";

export const dynamic = "force-dynamic";

const chip = "rounded border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] font-bold tracking-wider";

export default async function MovieDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const mediaId = Number(id);
  if (!Number.isInteger(mediaId)) notFound();

  const m = await getMedia(mediaId, user.id);
  if (!m) notFound();

  // semua yang memakai `m` harus berada SESUDAH pengecekan di atas
  const subs = await getSubtitles(m.id);
  const fullTitle = m.seriesTitle ? `${m.seriesTitle} ${m.title}` : m.title;
  const episodes = m.seriesTitle ? await getEpisodes(m.seriesTitle) : [];
  const warning = playbackWarning(m.mime, m.videoCodec, m.audioCodec);
  const resume = m.positionSec > 10;
  const playHref = resume
    ? `/watch/${m.id}?t=${Math.floor(m.positionSec)}`
    : `/watch/${m.id}`;
  const meta = [
    m.type === "series" ? m.title : null,
    m.year,
    formatDuration(m.durationSec),
    m.height ? `${m.height}p` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  // ---- data tambahan untuk tampilan ----
  const quality = qualityLabel(m.height);
  const pct = m.durationSec > 0 ? Math.round((m.positionSec / m.durationSec) * 100) : 0;
  const mbps = m.durationSec > 0 ? (m.sizeBytes * 8) / m.durationSec / 1e6 : 0;
  const container = m.mime.replace("video/", "").replace("x-matroska", "mkv").toUpperCase();
  const subLabels = subs.length ? subs.map((s) => s.label).join(", ") : "Tidak ada";
  const badges = [
    quality,
    (m.videoCodec ?? "").toUpperCase(),
    (m.audioCodec ?? "").toUpperCase(),
    subs.length ? "CC" : "",
  ].filter(Boolean);

  const summary = [
    m.type === "series"
      ? `Episode ${m.title} dari serial ${m.seriesTitle}${m.year ? ` (${m.year})` : ""}`
      : `Film${m.year ? ` tahun ${m.year}` : ""}`,
    `berdurasi ${formatDuration(m.durationSec)}`,
    m.width && m.height
      ? `dengan resolusi ${m.width}×${m.height} (${m.videoCodec ?? "?"}/${m.audioCodec ?? "?"})`
      : "",
  ]
    .filter(Boolean)
    .join(", ")
    .concat(
      `. ${subs.length ? `Subtitle tersedia: ${subLabels}.` : "Belum ada subtitle."}` +
        (resume ? ` Anda terakhir berhenti di ${formatClock(m.positionSec)} (${pct}%).` : ""),
    );

  const specs: [string, string][] = [
    ["Resolusi", m.width && m.height ? `${m.width}×${m.height}` : "?"],
    ["Codec", `${m.videoCodec ?? "?"} / ${m.audioCodec ?? "?"}`],
    ["Ukuran", formatSize(m.sizeBytes)],
    ["Subtitle", subLabels],
    ["Format", container],
  ];
  const details: [string, string][] = [
    ["Tipe", m.type === "series" ? `Series • S${m.season ?? "?"} E${m.episode ?? "?"}` : "Film"],
    ["Audio", (m.audioCodec ?? "?").toUpperCase()],
    ["Subtitle", subLabels],
    ["Bitrate rata-rata", mbps > 0 ? `${mbps.toFixed(1)} Mbps` : "?"],
  ];

  const eps = episodes.map((e) => ({
    id: e.id,
    title: e.title,
    season: e.season,
    episode: e.episode,
    durationSec: e.durationSec,
    hasPoster: !!e.posterPath,
  }));

  // Judul terkait: tipe dan tahun yang sama didahulukan, satu kartu per series
  const library = await getLibrary(user.id);
  const score = (x: Movie) => (x.type === m.type ? 2 : 0) + (x.year && x.year === m.year ? 1 : 0);
  const seen = new Set<string>();
  const related = library
    .filter((x) => x.id !== m.id && !(m.seriesTitle && x.seriesTitle === m.seriesTitle))
    .filter((x) => {
      const key = x.seriesTitle ?? `m${x.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => score(b) - score(a))
    .slice(0, 12);

  return (
    <>
      <Navbar user={user} q="" />
      <main className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <Link href="/" className="inline-block py-4 text-sm text-zinc-400 hover:text-zinc-100">
          ← Kembali ke Beranda
        </Link>

        <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          {m.hasPoster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/poster/${m.id}`}
              alt=""
              className="absolute inset-0 size-full scale-125 object-cover opacity-40 blur-3xl"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 70% 30%, hsl(${hueOf(fullTitle)} 60% 25%), transparent 70%)`,
              }}
            />
          )}
          <div className="absolute inset-0 bg-linear-to-r from-zinc-950 via-zinc-950/70 to-transparent" />

          <div className="relative flex items-center gap-8 p-6 sm:p-10 lg:p-14">
            <div className="max-w-2xl flex-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-brand">
                {m.type === "series" ? `Series • S${m.season ?? "?"} E${m.episode ?? "?"}` : "Film"}
              </p>
              <h1 className="mt-3 text-4xl font-black uppercase leading-none tracking-tight sm:text-5xl lg:text-6xl">
                {m.seriesTitle ?? m.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                <span className={chip}>{m.type === "series" ? "SERIES" : "FILM"}</span>
                {quality && <span className={chip}>{quality}</span>}
                {meta && <span>{meta}</span>}
              </div>

              {resume && (
                <div className="mt-4 max-w-md">
                  <div className="h-1 overflow-hidden rounded bg-white/20">
                    <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    Terakhir berhenti di {formatClock(m.positionSec)} ({pct}% selesai)
                  </p>
                </div>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-3 [&_button]:rounded-lg [&_button]:px-5 [&_button]:py-3 [&_button]:font-semibold">
                <Link
                  href={playHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 font-bold hover:opacity-90"
                >
                  <PlayIcon />
                  {resume ? `Lanjutkan ${formatClock(m.positionSec)}` : "Putar Sekarang"}
                </Link>
                {resume && (
                  <Link
                    href={`/watch/${m.id}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 px-5 py-3 font-semibold hover:bg-white/10"
                  >
                    ↺ Dari awal
                  </Link>
                )}
                <WatchTogetherButton mediaId={m.id} />
              </div>
            </div>

            <div className="hidden w-48 shrink-0 md:block lg:w-56">
              <Poster
                id={m.id}
                title={fullTitle}
                hasPoster={m.hasPoster}
                className="rounded-xl shadow-2xl ring-1 ring-white/10"
              />
            </div>
          </div>
        </section>

        {warning && (
          <p className="mt-4 rounded-md border border-amber-700 bg-amber-950/50 p-3 text-sm text-amber-200">
            ⚠ {warning}{" "}
            {user.isOwner && (
              <Link href="/convert" className="font-semibold underline hover:text-white">
                Buka menu Konversi
              </Link>
            )}
          </p>
        )}

        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold text-green-400">{pct > 0 ? `Ditonton ${pct}%` : "Belum ditonton"}</span>
            {m.year && <span className="text-zinc-300">{m.year}</span>}
            <span className="text-zinc-300">{formatDuration(m.durationSec)}</span>
            {badges.map((b) => (
              <span key={b} className={chip}>
                {b}
              </span>
            ))}
          </div>

          <div className="mt-5 grid gap-6 md:grid-cols-[1fr_16rem]">
            <div>
              <h2 className="text-lg font-bold">Ringkasan</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{summary}</p>

              <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-brand">
                  Spesifikasi file & stream
                </p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {specs.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-zinc-500">{k}</dt>
                      <dd className="font-mono">{v}</dd>
                    </div>
                  ))}
                  <dt className="text-zinc-500">File</dt>
                  <dd className="break-all rounded bg-black/40 px-2 py-1 font-mono text-xs text-zinc-300">
                    {m.filePath}
                  </dd>
                </dl>
              </div>
            </div>

            <dl className="h-fit space-y-3 border-zinc-800 text-sm md:border-l md:pl-6">
              {details.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {eps.length > 1 && (
          <EpisodeShelf
            episodes={eps}
            currentId={m.id}
            inRoom={false}
            basePath="/movie"
            nowLabel="SEDANG DILIHAT"
          />
        )}

        {related.length > 0 && (
          <Rail eyebrow="Dari perpustakaan Anda" title="Judul Terkait">
            {related.map((x) => (
              <div key={x.id} className="w-40 shrink-0 snap-start sm:w-44">
                <MovieCard movie={x} />
              </div>
            ))}
          </Rail>
        )}
      </main>
    </>
  );
}