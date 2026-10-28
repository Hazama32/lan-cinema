"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMsg } from "@/lib/chat";
import { formatClock, hueOf } from "@/lib/format";
import { getSocket } from "@/lib/socket";
import ReactionBar from "./ReactionBar";
import { useRoomCtx } from "./RoomContext";

type Item = { id: string; at: number; msg?: ChatMsg; sys?: string };

const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
let seq = 0;
const sysItem = (text: string): Item => ({ id: `s${++seq}`, at: Date.now(), sys: text });
const last200 = (l: Item[]) => l.slice(-200);
const seekVideo = (video: HTMLVideoElement, sec: number) => {
  video.currentTime = sec;
};

function Avatar({ name, className = "size-8 text-sm" }: { name: string; className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-bold ${className}`}
      style={{ backgroundColor: `hsl(${hueOf(name)} 45% 32%)` }}
    >
      {name[0]}
    </span>
  );
}

export default function RoomSidebar({ title }: { title: string }) {
  const ctx = useRoomCtx();
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [tag, setTag] = useState(true);
  const [now, setNow] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const prevMembers = useRef<Map<string, string> | null>(null);
  const prevHost = useRef("");

  const videoRef = ctx?.videoRef;
  const joined = ctx?.room.status === "joined";
  const info = ctx?.room.info ?? null;
  const myId = ctx?.room.myId ?? "";

  // Muat riwayat chat setiap kali (kembali) masuk room
  useEffect(() => {
    if (!joined) return;
    getSocket()
      .timeout(3000)
      .emit("room:history", (err: Error | null, list?: ChatMsg[]) => {
        if (err || !list) return;
        setItems((cur) =>
          [...list.map((m): Item => ({ id: m.id, at: m.at, msg: m })), ...cur.filter((i) => i.sys)].sort(
            (a, b) => a.at - b.at,
          ),
        );
      });
  }, [joined]);

  // Pesan baru dan pesan sistem dari aksi pemutaran
  useEffect(() => {
    const s = getSocket();
    const onChat = (m: ChatMsg) =>
      setItems((c) => (c.some((i) => i.id === m.id) ? c : last200([...c, { id: m.id, at: m.at, msg: m }])));
    const onState = (p: { by?: string; action?: string; state?: { pos?: number } }) => {
      const verbs: Record<string, string> = { play: "memutar di", pause: "menjeda di", seek: "melompat ke" };
      const verb = p.action ? verbs[p.action] : undefined;
      if (!p.by || !verb) return;
      setItems((c) => last200([...c, sysItem(`${p.by} ${verb} ${formatClock(p.state?.pos ?? 0)}`)]));
    };
    s.on("room:chat", onChat);
    s.on("room:state", onState);
    return () => {
      s.off("room:chat", onChat);
      s.off("room:state", onState);
    };
  }, []);

  // Pesan sistem: anggota bergabung/keluar dan pergantian host
  useEffect(() => {
    if (!info) return;
    const cur = new Map(info.members.map((m) => [m.id, m.name]));
    const prev = prevMembers.current;
    if (prev) {
      const add: Item[] = [];
      for (const [id, name] of cur) if (!prev.has(id)) add.push(sysItem(`${name} bergabung`));
      for (const [id, name] of prev) if (!cur.has(id)) add.push(sysItem(`${name} keluar`));
      if (info.hostId !== prevHost.current && cur.has(info.hostId))
        add.push(sysItem(`${cur.get(info.hostId)} sekarang menjadi host`));
      if (add.length) queueMicrotask(() => setItems((c) => last200([...c, ...add])));
    }
    prevMembers.current = cur;
    prevHost.current = info.hostId;
  }, [info]);

  // Posisi video untuk label "Sync @"
  useEffect(() => {
    const id = setInterval(() => setNow(videoRef?.current?.currentTime ?? 0), 1000);
    return () => clearInterval(id);
  }, [videoRef]);

  // Gulir otomatis ke pesan terbaru
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items]);

  if (!ctx) return null;
  const { room, roomCode } = ctx;
  const hostName = info?.members.find((m) => m.id === info.hostId)?.name;

  function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !ctx) return;
    const v = ctx.videoRef.current;
    getSocket().emit("room:chat", { text: t, t: tag && v ? v.currentTime : null });
    setText("");
  }
  function seekTo(sec: number) {
    const video = ctx?.videoRef.current;
    if (!video || (info?.hostOnly && !room.isHost)) return;
    seekVideo(video, sec); // sinkronisasi seek ditangani oleh useWatchRoom
  }

  return (
    <aside className="flex h-[70vh] min-h-112 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 lg:h-[calc(100vh-7rem)]">
      <div className="flex items-center gap-3 border-b border-zinc-800 p-4">
        <span className="grid size-10 place-items-center rounded-lg bg-brand/20 text-lg">💬</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-bold">
            Party Chat
            <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold tracking-wider">LIVE</span>
          </p>
          <p className="truncate text-xs text-zinc-400">
            Room #{roomCode} • {title}
          </p>
        </div>
        {room.isHost ? (
          <button
            onClick={() => room.setHostOnly(!info?.hostOnly)}
            aria-pressed={!!info?.hostOnly}
            title="Kunci kontrol: hanya host yang boleh play, pause, dan seek"
            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
              info?.hostOnly
                ? "border-brand bg-brand/20 text-white"
                : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            🔒 {info?.hostOnly ? "Terkunci" : "Kunci"}
          </button>
        ) : (
          info?.hostOnly && <span className="text-xs text-amber-300">🔒 Host saja</span>
        )}
      </div>

      <div className="border-b border-zinc-800 bg-zinc-950/40 px-4 py-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={joined ? "text-green-400" : "text-amber-300"}>
            ● {joined ? `Peer tersinkron (${info?.members.length ?? 0} online)` : "Menyambung…"}
          </span>
          {hostName && <span className="font-mono text-green-400">Host: {hostName}</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {info?.members.map((m) => (
            <div key={m.id} className="flex flex-col items-center gap-1">
              <span className="relative">
                <Avatar
                  name={m.name}
                  className={`size-9 text-sm ${m.id === myId ? "ring-2 ring-brand" : ""}`}
                />
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-zinc-900 bg-green-400" />
              </span>
              <span className="max-w-14 truncate text-[10px] text-zinc-400">
                {m.id === myId ? "Anda" : m.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div ref={box} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {items.length === 0 && (
          <p className="py-6 text-center text-sm text-zinc-500">Belum ada pesan. Sapa teman Anda 👋</p>
        )}
        {items.map((i) => {
          if (!i.msg)
            return (
              <p
                key={i.id}
                className="mx-auto w-fit max-w-full rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-center font-mono text-[11px] text-zinc-400"
              >
                {i.sys}
              </p>
            );
          const m = i.msg;
          const isHost = m.sid === info?.hostId;
          return (
            <div key={i.id} className="flex gap-2.5">
              <Avatar name={m.from} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-xs">
                  <span className={`font-semibold ${isHost ? "text-brand" : "text-zinc-200"}`}>
                    {m.sid === myId ? "Anda" : m.from}
                    {isHost && " [Host]"}
                  </span>
                  <span className="text-zinc-500">{hhmm(m.at)}</span>
                </p>
                <div className="mt-1 w-fit max-w-full rounded-xl border border-zinc-800 bg-zinc-800 px-3 py-2 text-sm">
                  {m.t !== null && (
                    <button
                      onClick={() => seekTo(m.t as number)}
                      title="Lompat ke posisi ini"
                      className="mb-1 mr-2 rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs hover:bg-black/50"
                    >
                      ⏱ {formatClock(m.t)}
                    </button>
                  )}
                  <span className="wrap-break-words">{m.text}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-zinc-800 p-3">
        <div className="flex items-center justify-between">
          <ReactionBar variant="chat" />
          <span className="font-mono text-[11px] text-zinc-500">Sync @ {formatClock(now)}</span>
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" checked={tag} onChange={(e) => setTag(e.target.checked)} />
          Sertakan posisi video
        </label>
        <form onSubmit={send} className="mt-2 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            placeholder="Chat dengan teman…"
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-500 focus:border-brand"
          />
          <button
            disabled={!text.trim() || !joined}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Kirim
          </button>
        </form>
      </div>
    </aside>
  );
}