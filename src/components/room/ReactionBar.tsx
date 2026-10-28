"use client";

import { REACTIONS } from "@/lib/chat";
import { getSocket } from "@/lib/socket";
import { useRoomCtx } from "./RoomContext";

export default function ReactionBar({ variant = "card" }: { variant?: "card" | "chat" }) {
  const ctx = useRoomCtx();
  if (!ctx?.roomCode) return null;
  const send = (emoji: string) => getSocket().emit("room:react", { emoji });

  if (variant === "chat") {
    return (
      <div className="flex gap-1">
        {REACTIONS.slice(0, 5).map((e) => (
          <button
            key={e}
            onClick={() => send(e)}
            className="grid size-8 place-items-center rounded-md text-lg transition hover:scale-125 hover:bg-zinc-800 active:scale-95"
          >
            {e}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1">
      <span className="mr-1 text-[11px] font-bold tracking-widest text-zinc-400">REAKSI</span>
      {REACTIONS.map((e) => (
        <button
          key={e}
          onClick={() => send(e)}
          className="grid size-8 place-items-center rounded-full text-lg transition hover:scale-125 active:scale-95"
        >
          {e}
        </button>
      ))}
    </div>
  );
}