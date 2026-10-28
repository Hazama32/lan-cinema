import fs from "node:fs/promises";
import path from "node:path";
import type { Server, Socket } from "socket.io";
import { prisma } from "../lib/prisma";
import { MEDIA_DIR, rescanFile } from "../lib/scanner";
import { MODE_LABEL, type Job } from "../lib/convert-plan";
import { checkOutput, extractSubs, prepare, transcode } from "./ffmpeg";

const jobs = new Map<number, Job>();
const queue: number[] = [];
const aborters = new Map<number, AbortController>();
let working = false;
let io: Server | null = null;

const emit = (j: Job) => io?.to("owners").emit("convert:update", { ...j });
const exists = (p: string) => fs.stat(p).then(() => true, () => false);
const relOf = (p: string) => path.relative(MEDIA_DIR, p).split(path.sep).join("/");
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const obj = (d: unknown): Record<string, unknown> =>
  typeof d === "object" && d !== null ? (d as Record<string, unknown>) : {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Di Windows, file yang sedang diputar/dipindai antivirus tak bisa dipindah. Coba beberapa kali.
async function renameRetry(from: string, to: string) {
  for (let i = 0; ; i++) {
    try {
      return await fs.rename(from, to);
    } catch (e) {
      if (i >= 4) throw new Error(`File sedang dipakai (ada yang menonton?). Coba lagi nanti. (${errText(e)})`);
      await sleep(3000);
    }
  }
}

async function runJob(job: Job) {
  const ac = new AbortController();
  aborters.set(job.id, ac);
  const set = (p: Partial<Job>) => {
    Object.assign(job, p);
    emit(job);
  };
  let tmp = "";

  try {
    set({ status: "running", pct: 0, speed: 0, etaSec: null, message: "Memeriksa file…" });
    const m = await prisma.media.findUnique({ where: { id: job.id } });
    if (!m) throw new Error("Media tidak ditemukan (mungkin sudah dihapus lewat Scan)");

    const input = path.resolve(MEDIA_DIR, m.filePath);
    if (!input.startsWith(MEDIA_DIR + path.sep)) throw new Error("Jalur di luar folder media");
    const stat = await fs.stat(input).catch(() => null);
    if (!stat) throw new Error("File tidak ada di disk");

    const plan = await prepare(input);
    if (!plan) throw new Error("Tidak ada stream video di file ini");
    if (plan.mode === "none") {
      set({ status: "done", mode: "none", pct: 100, message: "Sudah kompatibel, tidak perlu dikonversi" });
      return;
    }
    set({ mode: plan.mode, message: MODE_LABEL[plan.mode] });
    console.log(`[convert] #${job.id} ${m.filePath} -> mode ${plan.mode}`);

    const dir = path.dirname(input);
    const stem = path.basename(input, path.extname(input));
    const finalPath = path.join(dir, `${stem}.mp4`);
    tmp = path.join(dir, `${stem}.partial`); // ekstensi ini tidak dibaca scanner
    if (finalPath !== input && (await exists(finalPath)))
      throw new Error(`${stem}.mp4 sudah ada di folder yang sama`);

    // Ruang disk: salin/audio ≈ ukuran sumber; kodekan ulang bisa sampai 2× lipat
    const need = stat.size * (plan.mode === "video" ? 2 : 1.05);
    const fst = await fs.statfs(dir);
    const free = fst.bavail * fst.bsize;
    if (free < need)
      throw new Error(`Ruang disk kurang (butuh ± ${(need / 1e9).toFixed(1)} GB, tersedia ${(free / 1e9).toFixed(1)} GB)`);

    let last = 0;
    await transcode(plan, input, tmp, m.durationSec, ac.signal, (p) => {
      if (Date.now() - last < 1000) return;
      last = Date.now();
      set({ pct: Math.round(p.pct * 10) / 10, speed: p.speed, etaSec: p.etaSec });
    });
    await checkOutput(tmp, m.durationSec);

    set({ pct: 99.5, etaSec: 0, message: "Mengekstrak subtitle…" });
    const subs = await extractSubs(plan, input, dir, stem, ac.signal);

    set({ message: "Mengganti file…" });
    const orig = path.join(MEDIA_DIR, ".originals", path.relative(MEDIA_DIR, input));
    const dest = (await exists(orig)) ? `${orig}.${Date.now()}` : orig;
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await renameRetry(input, dest);
    try {
      await renameRetry(tmp, finalPath);
    } catch (e) {
      await fs.rename(dest, input).catch(() => {}); // kembalikan file asli
      throw e;
    }
    tmp = "";

    // Baris yang sama dipertahankan (progres, poster, ID tetap); hanya jalur & format yang berubah
    const relNew = relOf(finalPath);
    await prisma.media.deleteMany({ where: { filePath: relNew, NOT: { id: m.id } } });
    await prisma.media.update({ where: { id: m.id }, data: { filePath: relNew, mime: "video/mp4" } });
    await rescanFile(finalPath);

    const extra = [
      plan.hdr ? "HDR terdeteksi: warna bisa tampak pucat" : "",
      subs.length ? `${subs.length} subtitle diekstrak` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    set({ status: "done", pct: 100, etaSec: 0, speed: 0, message: `Selesai${extra ? " · " + extra : ""}` });
  } catch (e) {
    if (tmp) await fs.rm(tmp, { force: true }).catch(() => {});
    if (ac.signal.aborted) {
      set({ status: "canceled", message: "Dibatalkan", speed: 0, etaSec: null });
    } else {
      console.error(`[convert] #${job.id} gagal:`, errText(e));
      set({ status: "error", message: errText(e), speed: 0, etaSec: null });
    }
  } finally {
    aborters.delete(job.id);
  }
}

async function kick() {
  if (working) return;
  working = true;
  try {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      const job = jobs.get(id);
      if (job && job.status === "queued") await runJob(job);
    }
  } finally {
    working = false;
  }
}

const isActive = (j: Job) => j.status === "queued" || j.status === "running";

// Dipanggil dari realtime.ts untuk tiap koneksi. Hanya profil Owner yang dilayani.
export function registerConvert(server: Server, socket: Socket) {
  io = server;
  if (!socket.data.user?.isOwner) return;
  socket.join("owners");

  socket.on("convert:state", (ack: unknown) => {
    if (typeof ack === "function") ack([...jobs.values()]);
  });

  socket.on("convert:enqueue", async (data: unknown) => {
    try {
      const raw = obj(data).ids;
      const ids = [...new Set((Array.isArray(raw) ? raw : []).map(Number))]
        .filter((n) => Number.isInteger(n) && n > 0)
        .slice(0, 1000);
      if (!ids.length) return;

      const rows = await prisma.media.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true, seriesTitle: true },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const id of ids) {
        const r = byId.get(id);
        const cur = jobs.get(id);
        if (!r || (cur && isActive(cur))) continue;
        const job: Job = {
          id,
          title: r.seriesTitle ? `${r.seriesTitle} ${r.title}` : r.title,
          status: "queued",
          mode: null,
          pct: 0,
          speed: 0,
          etaSec: null,
          message: "Menunggu giliran",
        };
        jobs.set(id, job);
        queue.push(id);
        emit(job);
      }
      void kick();
    } catch (e) {
      console.error("[convert] enqueue:", errText(e));
    }
  });

  socket.on("convert:cancel", (data: unknown) => {
    const id = Number(obj(data).id);
    const job = jobs.get(id);
    if (!job) return;
    if (job.status === "queued") {
      const i = queue.indexOf(id);
      if (i >= 0) queue.splice(i, 1);
      job.status = "canceled";
      job.message = "Dibatalkan";
      emit(job);
    } else if (job.status === "running") {
      aborters.get(id)?.abort();
    }
  });

  socket.on("convert:cancelAll", () => {
    for (const id of [...queue]) {
      const job = jobs.get(id);
      if (job && job.status === "queued") {
        job.status = "canceled";
        job.message = "Dibatalkan";
        emit(job);
      }
    }
    queue.length = 0;
    for (const ac of aborters.values()) ac.abort();
  });

  socket.on("convert:clear", () => {
    for (const [id, j] of jobs) if (!isActive(j)) jobs.delete(id);
    io?.to("owners").emit("convert:all", [...jobs.values()]);
  });
}