import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { MEDIA_DIR } from "@/lib/scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Subtitle lama sering bukan UTF-8. Coba UTF-16 (BOM), lalu UTF-8 ketat, lalu Windows-1252.
function decode(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf); // BOM otomatis dibuang
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

function srtToVtt(src: string) {
  const body = src
    .replace(/\r\n?/g, "\n")
    .replace(/^.*-->.*$/gm, (line) => line.replace(/,/g, ".")) // 00:00:01,500 -> 00:00:01.500
    .replace(/\{\\an?\d+\}/g, ""); // buang tag posisi ala {\an8}
  return "WEBVTT\n\n" + body.trim() + "\n";
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("ID tidak valid", { status: 400 });

  const sub = await prisma.subtitle.findUnique({ where: { id }, select: { filePath: true } });
  if (!sub) return new Response("Subtitle tidak ditemukan", { status: 404 });

  const abs = path.resolve(MEDIA_DIR, sub.filePath);
  if (!abs.startsWith(MEDIA_DIR + path.sep)) return new Response("Akses ditolak", { status: 403 });

  let buf: Buffer;
  try {
    buf = await fs.readFile(abs);
  } catch {
    return new Response("File tidak ada di disk", { status: 404 });
  }
  if (buf.length > 5 * 1024 * 1024) return new Response("File terlalu besar", { status: 413 });

  const text = decode(buf);
  const vtt = abs.toLowerCase().endsWith(".vtt")
    ? text.startsWith("WEBVTT") ? text : "WEBVTT\n\n" + text
    : srtToVtt(text);

  return new Response(vtt, {
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    },
  });
}