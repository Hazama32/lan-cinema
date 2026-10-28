import { randomInt } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { prisma } from "../lib/prisma";
import { registerConvert } from "./convert";
import { registerRoomChat } from "./roomchat";

const COOKIE = "lc_user"; // sama dengan USER_COOKIE di src/lib/session.ts

type RoomState = { playing: boolean; pos: number; at: number; rate: number };
type Room = {
  code: string;
  mediaId: number;
  hostOnly: boolean;
  state: RoomState; // pos = detik video pada waktu server `at`
  members: Map<string, string>; // socket.id -> nama profil; anggota tertua = host
};

const rooms = new Map<string, Room>();
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // tanpa 0/O dan 1/I/L

const obj = (d: unknown): Record<string, unknown> =>
  typeof d === "object" && d !== null ? (d as Record<string, unknown>) : {};
const reply = (ack: unknown) =>
  typeof ack === "function" ? (ack as (r: unknown) => void) : () => {};
const hostOf = (r: Room) => r.members.keys().next().value ?? "";
const info = (r: Room) => ({
  members: [...r.members].map(([id, name]) => ({ id, name })),
  hostId: hostOf(r),
  hostOnly: r.hostOnly,
});

function newCode() {
  for (;;) {
    let c = "";
    for (let i = 0; i < 5; i++) c += ALPHABET[randomInt(ALPHABET.length)];
    if (!rooms.has(c)) return c;
  }
}

// Room kosong dihapus setelah masa tenggang (tahan reload halaman dan React StrictMode)
function scheduleCleanup(code: string, ms: number) {
  setTimeout(() => {
    const r = rooms.get(code);
    if (r && r.members.size === 0) {
      rooms.delete(code);
      console.log(`[room] ${code} dihapus (kosong)`);
    }
  }, ms);
}

async function userFromCookie(header: string | undefined) {
  const m = header ? new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)`).exec(header) : null;
  if (!m) return null;
  return prisma.user.findUnique({
    where: { id: Number(m[1]) },
    select: { id: true, name: true, isOwner: true },
  });
}

export function attachRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer);
  const online = () => io.of("/").sockets.size;

  function leaveRoom(socket: Socket) {
    const code: string | undefined = socket.data.room;
    if (!code) return;
    socket.data.room = undefined;
    socket.leave(code);
    const r = rooms.get(code);
    if (!r) return;
    r.members.delete(socket.id);
    if (r.members.size === 0) scheduleCleanup(code, 60_000);
    else io.to(code).emit("room:info", info(r)); // host baru otomatis = anggota tertua
  }

  // Identitas diambil dari cookie profil (httpOnly tetap ikut terkirim saat handshake)
  io.use(async (socket, next) => {
    try {
      socket.data.user = await userFromCookie(socket.handshake.headers.cookie);
    } catch {
      socket.data.user = null;
    }
    next();
  });

  io.on("connection", (socket) => {
    console.log(`[io] +${socket.id.slice(0, 5)} ${socket.data.user?.name ?? "anonim"} (${online()} online)`);
    io.emit("peers", online());
    registerConvert(io, socket);
    registerRoomChat(io, socket);

    // ---- Tahap 8 ----
    socket.on("time:ping", (ack: unknown) => {
      if (typeof ack === "function") ack(Date.now());
    });
    socket.on("chat:test", (msg: unknown) => {
      if (typeof msg !== "string" || !msg.trim()) return;
      io.emit("chat:test", { from: socket.id.slice(0, 5), msg: msg.slice(0, 200), at: Date.now() });
    });

    // ---- Tahap 9: room ----
    socket.on("room:create", async (data: unknown, ack: unknown) => {
      const cb = reply(ack);
      if (!socket.data.user) return cb({ error: "Pilih profil dulu" });
      const mediaId = Number(obj(data).mediaId);
      const media = Number.isInteger(mediaId)
        ? await prisma.media.findUnique({ where: { id: mediaId }, select: { id: true } })
        : null;
      if (!media) return cb({ error: "Media tidak ditemukan" });

      const code = newCode();
      rooms.set(code, {
        code,
        mediaId,
        hostOnly: false,
        state: { playing: false, pos: 0, at: Date.now(), rate: 1 },
        members: new Map(),
      });
      scheduleCleanup(code, 5 * 60_000); // dihapus bila tak ada yang masuk dalam 5 menit
      console.log(`[room] ${code} dibuat untuk media #${mediaId} oleh ${socket.data.user.name}`);
      cb({ code });
    });

    // Cek room tanpa masuk (dipakai kolom "Kode room" di Home)
    socket.on("room:lookup", (data: unknown, ack: unknown) => {
      const r = rooms.get(String(obj(data).code ?? "").trim().toUpperCase());
      reply(ack)(r ? { mediaId: r.mediaId } : { error: "Room tidak ditemukan" });
    });

    socket.on("room:join", (data: unknown, ack: unknown) => {
      const cb = reply(ack);
      const user = socket.data.user;
      if (!user) return cb({ error: "Pilih profil dulu" });
      const code = String(obj(data).code ?? "").trim().toUpperCase();
      const r = rooms.get(code);
      if (!r) return cb({ error: "Room tidak ditemukan" });

      if (socket.data.room && socket.data.room !== code) leaveRoom(socket);
      socket.join(code);
      socket.data.room = code;
      r.members.set(socket.id, user.name); // idempotent: join dua kali tidak mengubah urutan
      io.to(code).emit("room:info", info(r));
      console.log(`[room] ${code} +${user.name} (${r.members.size} anggota)`);
      cb({ mediaId: r.mediaId, state: r.state, ...info(r) });
    });

    socket.on("room:leave", () => leaveRoom(socket));

    socket.on("room:hostonly", (data: unknown) => {
      const r = rooms.get(socket.data.room ?? "");
      if (!r || hostOf(r) !== socket.id) return;
      r.hostOnly = !!obj(data).value;
      io.to(r.code).emit("room:info", info(r));
    });

    socket.on("room:control", (data: unknown) => {
      const r = rooms.get(socket.data.room ?? "");
      if (!r) return;
      if (r.hostOnly && hostOf(r) !== socket.id) {
        socket.emit("room:state", { state: r.state }); // ditolak: kembalikan ke state room
        return;
      }
      const d = obj(data);
      const action = String(d.action);
      const pos = Number(d.pos);
      const rate = Number(d.rate);
      if (!["play", "pause", "seek", "rate"].includes(action) || !Number.isFinite(pos) || pos < 0) return;

      const s = r.state;
      if (action === "play") s.playing = true;
      if (action === "pause") s.playing = false;
      if (action === "rate" && rate >= 0.25 && rate <= 4) s.rate = rate;
      s.pos = pos;
      s.at = Date.now();
            io.to(r.code).emit("room:state", { state: s, by: socket.data.user?.name, action });
    });

    socket.on("disconnect", (reason) => {
      leaveRoom(socket);
      console.log(`[io] -${socket.id.slice(0, 5)} (${reason}, ${online()} online)`);
      io.emit("peers", online());
    });
  });

  return io;
}