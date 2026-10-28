"use client";

import { useEffect, useState } from "react";
import { getSocket, measureClockOffset } from "@/lib/socket";

type Msg = { from: string; msg: string; at: number };

export default function RealtimeTest() {
  const [connected, setConnected] = useState(false);
  const [transport, setTransport] = useState("-");
  const [sid, setSid] = useState("-");
  const [peers, setPeers] = useState(0);
  const [clock, setClock] = useState<{ rtt: number; offset: number } | null>(null);
  const [log, setLog] = useState<Msg[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    const s = getSocket();

    const onUpgrade = (t: { name: string }) => setTransport(t.name);
    const onConnect = () => {
      setConnected(true);
      setSid(s.id ?? "-");
      setTransport(s.io.engine.transport.name);
      s.io.engine.once("upgrade", onUpgrade); // mulai dari polling, lalu naik ke websocket
      measureClockOffset(s).then(setClock).catch(() => {});
    };
    const onDisconnect = () => {
      setConnected(false);
      setTransport("-");
    };
    const onPeers = (n: number) => setPeers(n);
    const onChat = (m: Msg) => setLog((l) => [m, ...l].slice(0, 20));

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("peers", onPeers);
    s.on("chat:test", onChat);
    if (s.connected) onConnect();

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("peers", onPeers);
      s.off("chat:test", onChat);
    };
  }, []);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    getSocket().emit("chat:test", text);
    setText("");
  }

  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <h1 className="text-xl font-bold">Tes Realtime</h1>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-zinc-500">Status</dt>
        <dd className={connected ? "text-green-400" : "text-red-400"}>
          {connected ? "Terhubung" : "Terputus"}
        </dd>
        <dt className="text-zinc-500">Transport</dt>
        <dd>{transport}</dd>
        <dt className="text-zinc-500">ID socket</dt>
        <dd>{sid}</dd>
        <dt className="text-zinc-500">Online</dt>
        <dd>{peers}</dd>
        <dt className="text-zinc-500">RTT / offset jam</dt>
        <dd>{clock ? `${clock.rtt} ms / ${Math.round(clock.offset)} ms` : "-"}</dd>
      </dl>

      <form onSubmit={send} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ketik pesan lalu Enter…"
          className="flex-1 rounded-md bg-zinc-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-brand"
        />
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold">Kirim</button>
      </form>

      <ul className="space-y-1 text-sm">
        {log.map((m, i) => (
          <li key={`${m.at}-${i}`}>
            <span className="text-zinc-500">{m.from}:</span> {m.msg}
          </li>
        ))}
      </ul>
    </main>
  );
}