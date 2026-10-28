import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { MEDIA_DIR } from "@/lib/scanner";

export const runtime = "nodejs"; // butuh fs, tidak bisa di Edge
export const dynamic = "force-dynamic";

type Range = { start: number; end: number };

// Terjemahkan header "Range" menjadi rentang byte
function parseRange(header: string | null, size: number): Range | null | "unsatisfiable" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2])) return null; // format aneh / multi-range: abaikan, kirim penuh

  let start: number;
  let end: number;
  if (m[1] === "") {
    // "-500" = 500 byte terakhir
    const n = Number(m[2]);
    if (n === 0) return "unsatisfiable";
    start = Math.max(size - n, 0);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}

// File stream Node -> Web stream, dengan backpressure dan aman saat koneksi diputus
function toWebStream(stream: fs.ReadStream): ReadableStream<Uint8Array> {
  let done = false;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("data", (chunk) => {
        if (done) return;
        controller.enqueue(chunk as Buffer);
        if ((controller.desiredSize ?? 1) <= 0) stream.pause(); // klien lambat: jeda baca disk
      });
      stream.on("end", () => {
        if (!done) {
          done = true;
          controller.close();
        }
      });
      stream.on("error", (err) => {
        if (!done) {
          done = true;
          controller.error(err);
        }
      });
    },
    pull() {
      stream.resume(); // klien siap menerima lagi
    },
    cancel() {
      done = true;
      stream.destroy(); // klien menutup koneksi (misalnya saat seek)
    },
  });
}

const text = (status: number, msg: string) =>
  new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return text(400, "ID tidak valid");

  const media = await prisma.media.findUnique({
    where: { id },
    select: { filePath: true, mime: true, streamUrl: true },
  });
  if (!media) return text(404, "Media tidak ditemukan");

  if (media.streamUrl) {
    return Response.redirect(media.streamUrl, 302);
  }

  // Pertahanan berlapis: jalur di database pun harus tetap berada di dalam MEDIA_DIR
  const abs = path.resolve(MEDIA_DIR, media.filePath);
  if (!abs.startsWith(MEDIA_DIR + path.sep)) return text(403, "Akses ditolak");

  let size: number;
  try {
    size = (await fs.promises.stat(abs)).size;
  } catch {
    return text(404, "File tidak ada di disk");
  }

  const base = {
    "Content-Type": media.mime,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };
  const range = parseRange(req.headers.get("range"), size);

  if (range === "unsatisfiable") {
    return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
  }

  if (range === null) {
    console.log(`[stream] #${id} penuh (${size} byte)`); // log belajar, boleh dihapus nanti
    return new Response(toWebStream(fs.createReadStream(abs)), {
      status: 200,
      headers: { ...base, "Content-Length": String(size) },
    });
  }

  const { start, end } = range;
  console.log(`[stream] #${id} bytes ${start}-${end}/${size}`);
  return new Response(toWebStream(fs.createReadStream(abs, { start, end })), {
    status: 206,
    headers: {
      ...base,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
    },
  });
}