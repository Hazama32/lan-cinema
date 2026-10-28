import { prisma } from "@/lib/prisma";
import { isFinished } from "@/lib/series";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Belum memilih profil" }, { status: 401 });

  let body: { mediaId?: unknown; positionSec?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON tidak valid" }, { status: 400 });
  }

  const mediaId = Number(body.mediaId);
  const pos = Number(body.positionSec);
  if (!Number.isInteger(mediaId) || !Number.isFinite(pos) || pos < 0)
    return Response.json({ error: "Data tidak valid" }, { status: 400 });

  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { durationSec: true },
  });
  if (!media) return Response.json({ error: "Media tidak ditemukan" }, { status: 404 });

  // Ditonton >= 95%: simpan sebagai SELESAI (posisi = durasi).
  // Sengaja disimpan, bukan dihapus, supaya series tahu episode mana yang sudah tuntas.
  if (isFinished(pos, media.durationSec)) {
    await prisma.progress.upsert({
      where: { userId_mediaId: { userId: user.id, mediaId } },
      update: { positionSec: media.durationSec },
      create: { userId: user.id, mediaId, positionSec: media.durationSec },
    });
    return Response.json({ ok: true, finished: true });
  }
  // Baru mulai (< 5 detik): tidak perlu disimpan
  if (pos < 5) return Response.json({ ok: true, skipped: true });

  await prisma.progress.upsert({
    where: { userId_mediaId: { userId: user.id, mediaId } },
    update: { positionSec: pos },
    create: { userId: user.id, mediaId, positionSec: pos },
  });
  return Response.json({ ok: true });
}