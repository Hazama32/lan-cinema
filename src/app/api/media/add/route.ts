import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import fs from "node:fs/promises";
import path from "node:path";
import { POSTER_DIR } from "@/lib/scanner";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isOwner) {
    return Response.json({ error: "Hanya Owner yang dapat menambah media" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      title,
      type = "movie",
      seriesTitle,
      season,
      episode,
      year,
      description,
      streamUrl,
      posterUrl,
    } = body;

    if (!title || !streamUrl) {
      return Response.json({ error: "Judul dan Stream URL wajib diisi" }, { status: 400 });
    }

    const filePath = `online://tmdb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const media = await prisma.media.create({
      data: {
        title,
        type,
        seriesTitle: seriesTitle || null,
        season: season ? Number(season) : null,
        episode: episode ? Number(episode) : null,
        year: year ? Number(year) : null,
        description: description || null,
        streamUrl,
        mime: "video/mp4",
        filePath,
      },
    });

    if (posterUrl) {
      try {
        const fullPosterUrl = posterUrl.startsWith("/")
          ? `https://image.tmdb.org/t/p/w500${posterUrl}`
          : posterUrl;
        const res = await fetch(fullPosterUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          await fs.mkdir(POSTER_DIR, { recursive: true });
          await fs.writeFile(path.join(POSTER_DIR, `${media.id}-poster.jpg`), buf);
          await prisma.media.update({
            where: { id: media.id },
            data: { posterPath: `${media.id}-poster.jpg` },
          });
        }
      } catch (err) {
        console.error("Gagal mengunduh poster:", err);
      }
    }

    return Response.json({ success: true, media });
  } catch (err: unknown) {
    console.error("Gagal menambah media online:", err);
    const errorMessage = err instanceof Error ? err.message : "Gagal menambah media";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
