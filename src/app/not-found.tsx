import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Tidak ditemukan</h1>
      <p className="mt-2 text-zinc-400">Film atau halaman yang Anda cari tidak ada.</p>
      <Link href="/" className="mt-6 inline-block rounded-md bg-brand px-4 py-2">
        Kembali ke Home
      </Link>
    </main>
  );
}