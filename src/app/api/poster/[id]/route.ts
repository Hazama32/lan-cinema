import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { POSTER_DIR } from "@/lib/scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("ID tidak valid", { status: 400 });

  const m = await prisma.media.findUnique({ where: { id }, select: { posterPath: true } });
  if (!m?.posterPath) return new Response("Tidak ada poster", { status: 404 });

  const abs = path.resolve(POSTER_DIR, m.posterPath);
  if (!abs.startsWith(POSTER_DIR + path.sep)) return new Response("Akses ditolak", { status: 403 });

  try {
    const st = await fs.stat(abs);
    const etag = `"${st.size}-${Math.floor(st.mtimeMs)}"`;
    const headers = {
      ETag: etag,
      "Cache-Control": "no-cache", // selalu tanya dulu; 304 murah jika tidak berubah
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
    };
    if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(new Uint8Array(await fs.readFile(abs)), { headers });
  } catch {
    return new Response("File poster tidak ada", { status: 404 });
  }
}