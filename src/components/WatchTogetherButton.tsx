"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

export default function WatchTogetherButton({ mediaId }: { mediaId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function start() {
    setBusy(true);
    setMsg("");
    getSocket()
      .timeout(5000)
      .emit("room:create", { mediaId }, (err: Error | null, res?: { code?: string; error?: string }) => {
        setBusy(false);
        if (err) return setMsg("Server realtime tidak menjawab");
        if (!res?.code) return setMsg(res?.error ?? "Gagal membuat room");
        router.push(`/watch/${mediaId}?room=${res.code}`);
      });
  }

  return (
    <div>
      <button
        onClick={start}
        disabled={busy}
        className="rounded-md bg-zinc-800 px-4 py-2 hover:bg-zinc-700 disabled:opacity-50"
      >
        {busy ? "Membuat room…" : "👥 Watch Together"}
      </button>
      {msg && <p className="mt-1 text-xs text-red-400">{msg}</p>}
    </div>
  );
}