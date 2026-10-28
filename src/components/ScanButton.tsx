"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ScanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function scan() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/media/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan gagal");
      setMsg(
        `${data.found} file • ${data.added} baru • ${data.updated} diperbarui` +
          (data.warnings.length ? ` • ${data.warnings.length} peringatan (lihat terminal)` : ""),
      );
      router.refresh(); // ambil ulang data Server Component tanpa reload halaman
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={scan}
        disabled={busy}
        className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700 disabled:opacity-50"
      >
        {busy ? "Memindai…" : "Scan"}
      </button>
      {msg && <span className="hidden text-xs text-zinc-400 sm:inline">{msg}</span>}
    </div>
  );
}