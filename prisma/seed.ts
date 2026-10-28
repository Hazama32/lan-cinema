import { prisma } from "@/lib/prisma";

const M = (o: {
  title: string; type: string; year: number; min: number;
  seriesTitle?: string; season?: number; episode?: number;
}) => ({
  title: o.title,
  type: o.type,
  year: o.year,
  seriesTitle: o.seriesTitle,
  season: o.season,
  episode: o.episode,
  durationSec: o.min * 60,
  mime: "video/mp4",
  sizeBytes: BigInt(1_000_000_000),
  filePath: `/dummy/${o.seriesTitle ?? ""}${o.title}.mp4`,
});

async function main() {
  const owner = await prisma.user.upsert({
    where: { name: "Owner" }, update: {}, create: { name: "Owner", isOwner: true },
  });
  await prisma.user.upsert({
    where: { name: "Guest" }, update: {}, create: { name: "Guest" },
  });

  const samples = [
    M({ title: "Interstellar", type: "movie", year: 2014, min: 169 }),
    M({ title: "Inception", type: "movie", year: 2010, min: 148 }),
    M({ title: "Transformers", type: "movie", year: 2021, min: 155 }),
    M({ title: "S01E01", type: "series", year: 2008, min: 58, seriesTitle: "Breaking Bad", season: 1, episode: 1 }),
    M({ title: "S01E01", type: "series", year: 2005, min: 22, seriesTitle: "The Office", season: 1, episode: 1 }),
    M({ title: "Arrival", type: "movie", year: 2016, min: 116 }),
  ];

  const saved = [];
  for (const s of samples) {
    saved.push(
      await prisma.media.upsert({ where: { filePath: s.filePath }, update: {}, create: s }),
    );
  }

  // progres contoh untuk Owner: Interstellar 72%, Inception 34%, Breaking Bad 81%
  for (const [i, pct] of [[0, 72], [1, 34], [3, 81]] as const) {
    await prisma.progress.upsert({
      where: { userId_mediaId: { userId: owner.id, mediaId: saved[i].id } },
      update: {},
      create: { userId: owner.id, mediaId: saved[i].id, positionSec: (saved[i].durationSec * pct) / 100 },
    });
  }
  console.log("Seed selesai:", saved.length, "media");
}

main().finally(() => prisma.$disconnect());