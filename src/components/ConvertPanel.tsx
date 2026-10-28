"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MODE_LABEL, type Job, type Mode } from "@/lib/convert-plan";
import { formatSize } from "@/lib/format";
import { getSocket } from "@/lib/socket";

export type Item = {
  id: number;
  title: string;
  file: string;
  codec: string;
  sizeBytes: number;
  mode: Mode;
};

const STATUS: Record<Job["status"], string> = {
  queued: "Antre",
  running: "Berjalan",
  done: "Selesai",
  error: "Gagal",
  canceled: "Dibatalkan",
};
const COLOR: Record<Job["status"], string> = {
  queued: "text-zinc-400",
  running: "text-sky-300",
  done: "text-green-400",
  error: "text-red-400",
  canceled: "text-zinc-400",
};
const ORDER: Record<Job["status"], number> = { running: 0, queued: 1, error: 2, done: 3, canceled: 4 };

const eta = (s: number) =>
  s < 90 ? `${Math.round(s)} dtk` : s < 5400 ? `${Math.round(s / 60)} mnt` : `${(s / 3600).toFixed(1)} jam`;

const btn = "rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800";

export default function ConvertPanel({
  items,
  total,
  showAll,
}: {
  items: Item[];
  total: number;
  showAll: boolean;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Record<number, Job>>({});
  const [conn, setConn] = useState<"wait" | "ok" | "denied">("wait");

  useEffect(() => {
    const s = getSocket();
    const toMap = (l: Job[]) => Object.fromEntries(l.map((j) => [j.id, j]));
    const load = () => {
      s.timeout(3000).emit("convert:state", (err: Error | null, list?: Job[]) => {
        if (err || !list) return setConn("denied");
        setConn("ok");
        setJobs(toMap(list));
      });
    };
    const onUpdate = (j: Job) => {
      setJobs((p) => ({ ...p, [j.id]: j }));
      if (j.status === "done") router.refresh(); // daftar di server ikut diperbarui
    };
    const onAll = (l: Job[]) => setJobs(toMap(l));
    const onDisconnect = () => setConn("wait");

    s.on("connect", load);
    s.on("disconnect", onDisconnect);
    s.on("convert:update", onUpdate);
    s.on("convert:all", onAll);
    if (s.connected) load();
    return () => {
      s.off("connect", load);
      s.off("disconnect", onDisconnect);
      s.off("convert:update", onUpdate);
      s.off("convert:all", onAll);
    };
  }, [router]);

  const emit = (event: string, data?: unknown) => getSocket().emit(event, data);
  const busy = (id: number) => jobs[id]?.status === "queued" || jobs[id]?.status === "running";

  const need = items.filter((i) => i.mode !== "none");
  const pending = items.filter((i) => !busy(i.id));
  const pendingNeed = need.filter((i) => !busy(i.id));
  const list = Object.values(jobs).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const summary = (["copy", "audio", "video"] as const).map((m) => {
    const g = need.filter((i) => i.mode === m);
    return { m, n: g.length, bytes: g.reduce((s, i) => s + i.sizeBytes, 0) };
  });

  return (
    <div className="mt-6 space-y-8">
      {conn !== "ok" && (
        <p className="rounded-md border border-amber-700 bg-amber-950/50 p-3 text-sm text-amber-200">
          {conn === "wait"
            ? "Menyambung ke server…"
            : "Server tidak menjawab. Pastikan Anda masuk sebagai Owner dan server dijalankan lewat npm start / npm run dev, lalu tekan F5."}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {summary.map(({ m, n, bytes }) => (
          <div key={m} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-2xl font-bold">{n}</p>
            <p className="text-sm text-zinc-300">{MODE_LABEL[m]}</p>
            <p className="text-xs text-zinc-500">{formatSize(bytes)}</p>
          </div>
        ))}
      </div>

      {list.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Antrean & riwayat</h2>
            <div className="flex gap-2">
              <button className={btn} onClick={() => emit("convert:cancelAll")}>Batalkan semua</button>
              <button className={btn} onClick={() => emit("convert:clear")}>Hapus riwayat selesai</button>
            </div>
          </div>
          <ul className="space-y-3">
            {list.map((j) => (
              <li key={j.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{j.title}</p>
                    <p className="text-xs text-zinc-400">
                      <span className={COLOR[j.status]}>{STATUS[j.status]}</span>
                      {j.mode && j.mode !== "none" && <> · {MODE_LABEL[j.mode]}</>}
                      {j.status === "running" && (
                        <>
                          {" "}· {j.pct.toFixed(0)}%
                          {j.speed > 0 && <> · {j.speed.toFixed(1)}×</>}
                          {j.etaSec != null && j.etaSec > 0 && <> · sisa ± {eta(j.etaSec)}</>}
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{j.message}</p>
                  </div>
                  {busy(j.id) && (
                    <button className={btn} onClick={() => emit("convert:cancel", { id: j.id })}>
                      Batal
                    </button>
                  )}
                </div>
                {j.status === "running" && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded bg-zinc-700">
                    <div className="h-full bg-brand transition-all" style={{ width: `${j.pct}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">
            {showAll ? `Semua file (${total})` : `Perlu konversi (${need.length})`}
          </h2>
          <div className="flex gap-2">
            <Link href={showAll ? "/convert" : "/convert?semua=1"} className={btn}>
              {showAll ? "Hanya yang bermasalah" : "Tampilkan semua file"}
            </Link>
            <button
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
              disabled={conn !== "ok" || pendingNeed.length === 0}
              onClick={() => emit("convert:enqueue", { ids: pendingNeed.map((i) => i.id) })}
            >
              Konversi semua yang perlu ({pendingNeed.length})
            </button>
          </div>
        </div>

        {pending.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">
            {need.length === 0 ? "Semua file sudah kompatibel. 🎉" : "Semua sudah masuk antrean."}
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{i.title}</p>
                  <p className="truncate text-xs text-zinc-500">{i.file}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {i.codec} · {formatSize(i.sizeBytes)} · {MODE_LABEL[i.mode]}
                  </p>
                </div>
                <button
                  className={btn}
                  disabled={conn !== "ok"}
                  onClick={() => emit("convert:enqueue", { ids: [i.id] })}
                >
                  {i.mode === "none" ? "Periksa & konversi" : "Konversi"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}