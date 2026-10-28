import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

// Panggil HANYA dari useEffect (browser), jangan di tingkat modul atau saat render.
// Komponen klien tetap dirender sekali di server, dan di sana tidak ada browser.
export function getSocket(): Socket {
  if (!socket) socket = io(); // tanpa URL = server asal halaman ini (otomatis cocok di LAN)
  return socket;
}

// Selisih jam: waktuServer ≈ Date.now() + offset.
// Ambil beberapa sampel, pakai yang RTT-nya terkecil (paling sedikit terganggu jaringan).
export async function measureClockOffset(s: Socket, samples = 5) {
  let best = { rtt: Infinity, offset: 0 };
  for (let i = 0; i < samples; i++) {
    const t0 = Date.now();
    const server: number = await s.timeout(2000).emitWithAck("time:ping");
    const t1 = Date.now();
    const rtt = t1 - t0;
    if (rtt < best.rtt) best = { rtt, offset: server + rtt / 2 - t1 };
  }
  return best;
}