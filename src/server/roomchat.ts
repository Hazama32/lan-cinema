import type { Server, Socket } from "socket.io";
import { REACTIONS, type ChatMsg } from "../lib/chat";

const HISTORY = 80;
const history = new Map<string, { at: number; msgs: ChatMsg[] }>();
let seq = 0;

const obj = (d: unknown): Record<string, unknown> =>
  typeof d === "object" && d !== null ? (d as Record<string, unknown>) : {};

// Batasi laju agar chat tidak bisa dibanjiri: maks `max` event per `ms` per koneksi
function limiter(max: number, ms: number) {
  let n = 0;
  let start = Date.now();
  return () => {
    const now = Date.now();
    if (now - start > ms) {
      start = now;
      n = 0;
    }
    return ++n <= max;
  };
}

// Buang riwayat room yang sudah lama tidak dipakai
function prune() {
  const cutoff = Date.now() - 6 * 3600_000;
  for (const [code, h] of history) if (h.at < cutoff) history.delete(code);
}

export function registerRoomChat(io: Server, socket: Socket) {
  const chatOk = limiter(5, 5000);
  const reactOk = limiter(12, 5000);

  socket.on("room:history", (ack: unknown) => {
    const code: string | undefined = socket.data.room;
    if (typeof ack === "function") ack(code ? (history.get(code)?.msgs ?? []) : []);
  });

  socket.on("room:chat", (data: unknown) => {
    const code: string | undefined = socket.data.room;
    if (!code || !chatOk()) return;
    const d = obj(data);
    const text = typeof d.text === "string" ? d.text.trim().slice(0, 300) : "";
    if (!text) return;
    const t = typeof d.t === "number" && Number.isFinite(d.t) && d.t >= 0 ? Math.floor(d.t) : null;

    const msg: ChatMsg = {
      id: `${Date.now().toString(36)}${(seq++).toString(36)}`,
      sid: socket.id,
      from: socket.data.user?.name ?? "Anonim",
      text,
      t,
      at: Date.now(),
    };
    const h = history.get(code) ?? { at: 0, msgs: [] };
    h.msgs.push(msg);
    if (h.msgs.length > HISTORY) h.msgs.shift();
    h.at = msg.at;
    history.set(code, h);
    if (history.size > 50) prune();

    io.to(code).emit("room:chat", msg);
  });

  socket.on("room:react", (data: unknown) => {
    const code: string | undefined = socket.data.room;
    if (!code || !reactOk()) return;
    const emoji = obj(data).emoji;
    if (typeof emoji !== "string" || !(REACTIONS as readonly string[]).includes(emoji)) return;
    io.to(code).emit("room:react", { emoji, from: socket.data.user?.name ?? "Anonim" });
  });
}