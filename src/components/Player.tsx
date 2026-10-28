"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useWatchRoom } from "@/lib/useWatchRoom";
import type { SubtitleTrack } from "@/lib/types";
import { PlayIcon } from "./icons";
import ReactionOverlay from "./room/ReactionOverlay";
import { RoomContext } from "./room/RoomContext";

const pill =
  "rounded-full border border-white/15 bg-black/70 px-3 py-1 font-mono text-xs backdrop-blur";

export default function Player({
  mediaId,
  startAt,
  subtitles = [],
  roomCode = null,
  top,
  overlay,
  actions,
  playLabel = "Putar",
  below,
  side,
}: {
  mediaId: number;
  startAt: number;
  subtitles?: SubtitleTrack[];
  roomCode?: string | null;
  top?: ReactNode;
  overlay?: ReactNode;
  actions?: ReactNode;
  playLabel?: string;
  below?: ReactNode;
  side?: ReactNode;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(-1);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(true);
  const room = useWatchRoom(ref, roomCode, mediaId);
  const inRoom = !!roomCode;

  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    const save = () => {
      const pos = v.currentTime;
      if (!Number.isFinite(pos) || pos < 5 || Math.abs(pos - lastSaved.current) < 1) return;
      lastSaved.current = pos;
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId, positionSec: pos }),
        keepalive: true,
      }).catch(() => {});
    };

    const onHidden = () => {
      if (document.visibilityState === "hidden") save();
    };

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        if (v.paused) v.play().catch(() => {});
        else v.pause();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        v.currentTime += 10;
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        v.currentTime -= 10;
      } else if (e.key === "f") {
        if (document.fullscreenElement) document.exitFullscreen();
        else v.requestFullscreen?.();
      } else if (e.key === "m") {
        v.muted = !v.muted;
      }
    };

    const timer = setInterval(() => {
      if (!v.paused) save();
    }, 5000);

    v.addEventListener("pause", save);
    v.addEventListener("ended", save);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", save);
    document.addEventListener("keydown", onKey);

    return () => {
      clearInterval(timer);
      v.removeEventListener("pause", save);
      v.removeEventListener("ended", save);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("keydown", onKey);
      save();
    };
  }, [mediaId]);

  const dot = room.status === "joined" ? "bg-green-400" : room.status === "error" ? "bg-red-500" : "bg-amber-300";
  const chip =
    room.status === "joined"
      ? room.isHost
        ? "ANDA HOST"
        : `SINKRON ${Math.abs(room.drift ?? 0).toFixed(1)}s drift`
      : room.status === "error"
        ? room.error
        : "Menyambung…";

  return (
    <RoomContext.Provider value={{ roomCode, videoRef: ref, room }}>
      {top}
      <div className={inRoom ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" : ""}>
        <div className="min-w-0">
          <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-black">
            <video
              ref={ref}
              src={`/api/stream/${mediaId}`}
              controls
              autoPlay={!roomCode}
              playsInline
              preload="metadata"
              className="aspect-video w-full bg-black"
              onPlay={() => setPaused(false)}
              onPause={() => setPaused(true)}
              onEnded={() => setPaused(true)}
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (startAt > 0) v.currentTime = Math.min(startAt, Math.max(v.duration - 1, 0));
                const enableTracks = () => {
                  const tracks = Array.from(v.textTracks);
                  if (tracks.length && !tracks.some((t) => t.mode === "showing")) {
                    tracks[0].mode = "showing";
                  }
                };
                enableTracks();
                setTimeout(enableTracks, 500);
                setTimeout(enableTracks, 1500);
              }}
              onError={(e) => {
                const code = e.currentTarget.error?.code;
                setError(
                  code === 3 || code === 4
                    ? "Browser ini tidak bisa memutar format/codec video ini. Owner dapat mengonversinya di menu Konversi."
                    : `Gagal memutar video (kode ${code ?? "?"}).`,
                );
              }}
            >
              {subtitles.map((s, i) => (
                <track
                  key={s.id}
                  kind="subtitles"
                  src={`/api/subtitle/${s.id}`}
                  srcLang={s.language}
                  label={s.label}
                  default={i === 0}
                />
              ))}
            </video>

            {/* Lapisan info: hanya di bagian atas, jadi kontrol bawaan di bawah tetap bisa dipakai */}
            {paused && (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-linear-to-b from-black/90 via-black/55 to-transparent px-4 pb-20 pt-4 sm:px-6">
                <div className="max-w-[70%]">{overlay}</div>
                <div className="pointer-events-auto mt-4 flex flex-wrap items-start gap-2">
                  <button
                    onClick={() => ref.current?.play().catch(() => {})}
                    className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 font-bold hover:opacity-90"
                  >
                    <PlayIcon />
                    {playLabel}
                  </button>
                  {actions}
                </div>
              </div>
            )}

            {inRoom && (
              <div className="pointer-events-none absolute right-3 top-3 z-20 flex flex-wrap justify-end gap-1.5">
                <span className={`${pill} flex items-center gap-2`}>
                  <span className={`size-2 rounded-full ${dot}`} />
                  {chip}
                </span>
                {room.info?.hostOnly && <span className={pill}>🔒 HANYA HOST</span>}
              </div>
            )}
            {inRoom && <ReactionOverlay />}

            {room.needTap && (
              <button
                onClick={room.resume}
                className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-md bg-brand px-5 py-3 font-semibold"
              >
                ▶ Tap untuk ikut menonton
              </button>
            )}
          </div>

          {error && (
            <p className="mt-3 rounded-md border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">
              {error}
            </p>
          )}

          {below}
        </div>

        {inRoom && <div className="lg:sticky lg:top-20 lg:self-start">{side}</div>}
      </div>
    </RoomContext.Provider>
  );
}