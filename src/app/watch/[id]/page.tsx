import Link from "next/link";
import { notFound } from "next/navigation";
import EpisodeShelf from "@/components/EpisodeShelf";
import Navbar from "@/components/Navbar";
import Player from "@/components/Player";
import ReactionBar from "@/components/room/ReactionBar";
import RoomSidebar from "@/components/room/RoomSidebar";
import TopBar from "@/components/room/TopBar";
import WatchTogetherButton from "@/components/WatchTogetherButton";
import { formatClock, formatDuration, formatSize, hueOf, playbackWarning } from "@/lib/format";
import { getEpisodes, getLibrary, getMedia, getSubtitles } from "@/lib/media";
import { requireUser } from "@/lib/session";
import type { Movie } from "@/lib/types";
import { qualityLabel } from "@/lib/ui";

export const dynamic = "force-dynamic";

const chip = "rounded border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] font-bold tracking-wider";

function Related({ x }: { x: Movie }) {
  const name = x.seriesTitle ?? x.title;
  const q = qualityLabel(x.height);
  return (
    <Link
      href={`/watch/${x.id}`}
      className="group block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition hover:border-zinc-600"
    >
      <div
        className="relative aspect-video overflow-hidden"
        style={x.hasPoster ? undefined : { backgroundColor: `hsl(${hueOf(name)} 45% 28%)` }}
      >
        {x.hasPoster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/poster/${x.id}`}
            alt=""
            loading="lazy"
            className="size-full object-cover object-[50%_25%] transition duration-300 group-hover:scale-105"
          />
        )}
        {x.type === "series" && (
          <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold tracking-wider">
            SERIES
          </span>
        )}
        {q && (
          <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold tracking-wider">
            {q}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="truncate font-semibold">{name}</p>
        <p className="mt-0.5 text-xs text-zinc-400">
          {[x.year, formatDuration(x.durationSec)].filter(Boolean).join(" • ")}
        </p>
        <p className="mt-2 text-xs font-semibold text-brand">▶ Nonton</p>
      </div>
    </Link>
  );
}

export default async function Watch({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string | string[]; room?: string | string[] }>;
}) {
  const user = await requireUser();
  const mediaId = Number((await params).id);
  if (!Number.isInteger(mediaId)) notFound();

  const m = await getMedia(mediaId, user.id);
  if (!m) notFound();
  const subtitles = await getSubtitles(m.id);
  const episodes = m.seriesTitle ? await getEpisodes(m.seriesTitle) : [];

  const sp = await searchParams;
  const rawRoom = typeof sp.room === "string" ? sp.room.trim().toUpperCase() : "";
  const roomCode = /^[A-Z0-9]{4,8}$/.test(rawRoom) ? rawRoom : null;
  const t = Number(typeof sp.t === "string" ? sp.t : 0);
  const startAt = !roomCode && Number.isFinite(t) && t > 0 ? t : 0;

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
    .slice(0, 6);

  const title = m.seriesTitle ?? m.title;
  const warning = playbackWarning(m.mime, m.videoCodec, m.audioCodec);
  const quality = qualityLabel(m.height);
  const mbps = m.durationSec > 0 ? (m.sizeBytes * 8) / m.durationSec / 1e6 : 0;
  const pct = m.durationSec > 0 ? Math.round((m.positionSec / m.durationSec) * 100) : 0;
  const container = m.mime.replace("video/", "").replace("x-matroska", "mkv").toUpperCase();
  const subLabels = subtitles.length ? subtitles.map((s) => s.label).join(", ") : "Tidak ada";
  const badges = [
    quality,
    (m.videoCodec ?? "").toUpperCase(),
    (m.audioCodec ?? "").toUpperCase(),
    subtitles.length ? "CC" : "",
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
      `. ${subtitles.length ? `Subtitle tersedia: ${subLabels}.` : "Belum ada subtitle."}` +
        (m.positionSec > 10 ? ` Anda terakhir berhenti di ${formatClock(m.positionSec)} (${pct}%).` : ""),
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

  const overlay = (
    <>
      <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">
        <span className="text-brand">{m.type === "series" ? "SERIES" : "FILM"}</span>
        {m.year ? ` • ${m.year}` : ""}
      </p>
      <h1 className="mt-2 text-2xl font-black leading-tight sm:text-4xl">{title}</h1>
      <p className="mt-1 text-sm text-zinc-300">
        {[
          m.type === "series" ? `Episode ${m.episode ?? "?"}` : null,
          formatDuration(m.durationSec),
          m.height ? `${m.height}p` : null,
        ]
          .filter(Boolean)
          .join(" • ")}
      </p>
    </>
  );

  const actions = (
    <>
      {!roomCode && <WatchTogetherButton mediaId={m.id} />}
      {startAt > 0 && (
        <Link href={`/watch/${m.id}`} className="rounded-md bg-zinc-800 px-4 py-2 hover:bg-zinc-700">
          ↺ Dari awal
        </Link>
      )}
    </>
  );

  const below = (
    <>
      {warning && (
        <p className="mt-4 rounded-md border border-amber-700 bg-amber-950/50 p-3 text-sm text-amber-200">
          ⚠ {warning}
        </p>
      )}

      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
          {roomCode && <ReactionBar variant="card" />}
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

      {eps.length > 1 && <EpisodeShelf episodes={eps} currentId={m.id} inRoom={!!roomCode} />}

      {related.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold">Judul Terkait</h2>
            <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">Dari perpustakaan Anda</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {related.map((x) => (
              <Related key={x.id} x={x} />
            ))}
          </div>
        </section>
      )}
    </>
  );

  return (
    <>
      <Navbar user={user} q="" />
      <main className="mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6">
        <Player
          mediaId={m.id}
          startAt={startAt}
          subtitles={subtitles}
          roomCode={roomCode}
          top={<TopBar backHref="/" backLabel="Kembali ke Beranda" />}
          overlay={overlay}
          actions={actions}
          playLabel={startAt > 0 ? `Lanjutkan ${formatClock(startAt)}` : "Putar"}
          below={below}
          side={roomCode ? <RoomSidebar title={title} /> : undefined}
        />
      </main>
    </>
  );
}