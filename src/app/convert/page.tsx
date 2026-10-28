import { redirect } from "next/navigation";
import ConvertPanel, { type Item } from "@/components/ConvertPanel";
import Navbar from "@/components/Navbar";
import { estimateMode } from "@/lib/convert-plan";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ConvertPage({
  searchParams,
}: {
  searchParams: Promise<{ semua?: string | string[] }>;
}) {
  const user = await requireUser();
  if (!user.isOwner) redirect("/");
  const showAll = (await searchParams).semua === "1";

  const rows = await prisma.media.findMany({
    select: {
      id: true,
      title: true,
      seriesTitle: true,
      filePath: true,
      mime: true,
      videoCodec: true,
      audioCodec: true,
      sizeBytes: true,
    },
    orderBy: { filePath: "asc" },
  });

  const all: Item[] = rows.map((r) => ({
    id: r.id,
    title: r.seriesTitle ? `${r.seriesTitle} ${r.title}` : r.title,
    file: r.filePath,
    codec: `${(r.filePath.split(".").pop() ?? "").toUpperCase()} · ${r.videoCodec ?? "?"}/${r.audioCodec ?? "?"}`,
    sizeBytes: Number(r.sizeBytes),
    mode: estimateMode(r.mime, r.videoCodec, r.audioCodec),
  }));
  const items = showAll ? all : all.filter((i) => i.mode !== "none");

  return (
    <>
      <Navbar user={user} q="" />
      <main className="mx-auto max-w-5xl px-4 pb-10 sm:px-6">
        <p className="mt-8 text-[11px] font-bold uppercase tracking-widest text-brand">Pemeliharaan</p>
        <h1 className="text-3xl font-black">Konversi video</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Mengubah file yang tidak bisa diputar di semua perangkat (MKV, HEVC, audio AC3/DTS) menjadi MP4
          H.264 + AAC. File asli dipindah ke <code>media/.originals</code>, bukan dihapus.
        </p>
        <ConvertPanel items={items} total={all.length} showAll={showAll} />
      </main>
    </>
  );
}