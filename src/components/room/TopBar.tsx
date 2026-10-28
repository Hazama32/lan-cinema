"use client";

import Link from "next/link";
import { useRoomCtx } from "./RoomContext";

export default function TopBar({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  const ctx = useRoomCtx();
  const room = ctx?.room;
  const n = room?.info?.members.length ?? 0;
  const joined = room?.status === "joined";
  const dot = joined ? "bg-green-400" : room?.status === "error" ? "bg-red-500" : "bg-amber-300";
  const text = joined
    ? `${room?.drift == null ? "0" : Math.round(Math.abs(room.drift) * 1000)}ms drift • ${n} terhubung`
    : room?.status === "error"
      ? room.error
      : "Menyambung…";

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
      <Link href={backHref} className="text-zinc-400 hover:text-zinc-100">
        ← {backLabel}
      </Link>
      {ctx?.roomCode && (
        <p className="flex items-center gap-2 font-mono text-xs text-zinc-300">
          <span className={`size-2 rounded-full ${dot}`} />
          <span className="font-bold text-brand">ROOM #{ctx.roomCode}</span>
          <span className="text-zinc-400">{text}</span>
        </p>
      )}
    </div>
  );
}