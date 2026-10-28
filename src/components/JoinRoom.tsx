"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

export default function JoinRoom() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return;
    setMsg("");
    getSocket()
      .timeout(5000)
      .emit("room:lookup", { code: c }, (err: Error | null, res?: { mediaId?: number; error?: string }) => {
        if (err) return setMsg("Server tidak menjawab");
        if (!res?.mediaId) return setMsg(res?.error ?? "Room tidak ditemukan");
        router.push(`/watch/${res.mediaId}?room=${c}`);
      });
  }

  return (
    <form onSubmit={join} className="flex items-center gap-1">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Kode room"
        maxLength={8}
        className="w-24 rounded-md bg-zinc-800 px-2 py-1.5 text-sm uppercase outline-none placeholder:normal-case placeholder:text-zinc-500 focus:ring-1 focus:ring-brand"
      />
      <button className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700">Gabung</button>
      {msg && <span className="text-xs text-red-400">{msg}</span>}
    </form>
  );
}