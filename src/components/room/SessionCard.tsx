"use client";

import Link from "next/link";
import { hueOf } from "@/lib/format";
import { useRoomCtx } from "./RoomContext";

const cell = "rounded-lg bg-zinc-800/60 px-4 py-3";
const cap = "text-[10px] font-bold uppercase tracking-widest text-zinc-500";

export default function SessionCard({ mediaId, bitrateMbps }: { mediaId: number; bitrateMbps: number }) {
  const ctx = useRoomCtx();
  if (!ctx?.roomCode) return null;
  const { room, roomCode } = ctx;
  const info = room.info;
  const hostId = info?.hostId;
  const host = info?.members.find((m) => m.id === hostId);
  const tone =
    room.status === "joined" ? "text-green-400" : room.status === "error" ? "text-red-400" : "text-amber-300";
  const label =
    room.status === "joined" ? "Tersambung" : room.status === "error" ? room.error : "Menyambung…";

  return (
    <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Operator sesi</p>
        <span className={`text-sm ${tone}`}>● {label}</span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <div className={cell}>
          <p className={cap}>Kode room</p>
          <p className="font-mono text-2xl font-bold tracking-widest text-brand">{roomCode}</p>
        </div>
        <div className={cell}>
          <p className={cap}>Host</p>
          <div className="mt-1 flex items-center gap-2">
            {host && (
              <span
                className="grid size-7 place-items-center rounded-full text-xs font-bold"
                style={{ backgroundColor: `hsl(${hueOf(host.name)} 45% 32%)` }}
              >
                {host.name[0]}
              </span>
            )}
            <span className="truncate font-semibold">{host?.name ?? "-"}</span>
          </div>
        </div>
        <div className={cell}>
          <p className={cap}>Kunci sinkron</p>
          <p className="text-lg font-bold">{info?.hostOnly ? "KETAT (HOST)" : "TERBUKA"}</p>
        </div>
        <div className={cell}>
          <p className={cap}>Bitrate rata-rata</p>
          <p className="text-lg font-bold">{bitrateMbps > 0 ? `${bitrateMbps.toFixed(1)} Mbps` : "?"}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        {room.isHost ? (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!info?.hostOnly}
              onChange={(e) => room.setHostOnly(e.target.checked)}
            />
            Hanya host yang boleh play, pause, dan seek
          </label>
        ) : (
          <span className="text-zinc-400">
            {info?.hostOnly ? "Hanya host yang mengendalikan pemutaran." : "Semua anggota boleh mengendalikan."}
          </span>
        )}
        <Link href={`/watch/${mediaId}`} className="rounded-md border border-zinc-700 px-3 py-1.5 hover:bg-zinc-800">
          Keluar room
        </Link>
      </div>
    </section>
  );
}