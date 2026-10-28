// Pembungkus ffmpeg/ffprobe untuk konversi (tanpa database; hanya proses dan berkas).
import { spawn, execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { makePlan, mainArgs, subArgs, type FfStream, type Plan } from "../lib/convert-plan";

const run = promisify(execFile);

export type Progress = { pct: number; speed: number; etaSec: number | null };

export async function probeStreams(file: string): Promise<FfStream[]> {
  const { stdout } = await run(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_streams", file],
    { maxBuffer: 20 * 1024 * 1024, timeout: 60_000 },
  );
  return (JSON.parse(stdout).streams ?? []) as FfStream[];
}

export async function prepare(input: string): Promise<Plan | null> {
  const ext = path.extname(input).toLowerCase();
  return makePlan(await probeStreams(input), ext === ".mp4" || ext === ".m4v" ? "mp4" : "other");
}

function runFfmpeg(
  args: string[],
  durationSec: number,
  signal: AbortSignal,
  onProgress?: (p: Progress) => void,
) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new Error("Dibatalkan"));
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    try {
      // prioritas rendah supaya streaming ke penonton tetap lancar saat konversi berjalan
      if (p.pid) os.setPriority(p.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
    } catch {
      /* tidak kritis */
    }

    let tail = "";
    let buf = "";
    let speed = 0;
    let sec = 0;
    const onAbort = () => p.kill("SIGKILL");
    signal.addEventListener("abort", onAbort, { once: true });

    p.stderr.on("data", (d: Buffer) => {
      tail = (tail + d.toString()).slice(-2000);
    });
    p.stdout.on("data", (d: Buffer) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const i = line.indexOf("=");
        const k = line.slice(0, i);
        const v = line.slice(i + 1).trim();
        if (k === "out_time_us") {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 0) sec = n / 1e6;
        } else if (k === "speed") {
          speed = parseFloat(v) || 0;
        } else if (k === "progress" && onProgress && durationSec > 0) {
          onProgress({
            pct: Math.min(99, (sec / durationSec) * 100),
            speed,
            etaSec: speed > 0 ? Math.max(0, (durationSec - sec) / speed) : null,
          });
        }
      }
    });
    p.on("error", (e: NodeJS.ErrnoException) => {
      signal.removeEventListener("abort", onAbort);
      reject(new Error(e.code === "ENOENT" ? "ffmpeg tidak ditemukan di PATH" : e.message));
    });
    p.on("close", (code) => {
      signal.removeEventListener("abort", onAbort);
      if (signal.aborted) return reject(new Error("Dibatalkan"));
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg gagal (kode ${code}): ${tail.trim().split("\n").slice(-3).join(" | ")}`));
    });
  });
}

export function transcode(
  plan: Plan,
  input: string,
  output: string,
  durationSec: number,
  signal: AbortSignal,
  onProgress: (p: Progress) => void,
) {
  return runFfmpeg(mainArgs(plan, input, output), durationSec, signal, onProgress);
}

// Hasil harus berdurasi hampir sama dengan sumbernya, kalau tidak berarti konversi terpotong
export async function checkOutput(file: string, expectedSec: number) {
  const { stdout } = await run(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { timeout: 60_000 },
  );
  const dur = Number(stdout.trim());
  if (!(dur > 0) || (expectedSec > 0 && dur < expectedSec * 0.97)) {
    throw new Error(`Hasil konversi tidak lengkap (${Math.round(dur || 0)} dari ${Math.round(expectedSec)} detik)`);
  }
}

// Ekstrak subtitle teks di dalam MKV menjadi <nama>.<bahasa>.srt. Tidak menimpa file yang sudah ada.
export async function extractSubs(plan: Plan, input: string, dir: string, stem: string, signal: AbortSignal) {
  const written: string[] = [];
  for (const s of plan.subs) {
    if (signal.aborted) throw new Error("Dibatalkan");
    const out = path.join(dir, `${stem}.${s.tag}.srt`);
    if (await fs.stat(out).then(() => true, () => false)) continue;
    try {
      await runFfmpeg(subArgs(input, s.index, out), 0, signal);
      written.push(path.basename(out));
    } catch {
      await fs.rm(out, { force: true }).catch(() => {});
    }
  }
  return written;
}