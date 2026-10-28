import os from "node:os";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const virtual = /vethernet|virtual|vmware|vbox|wsl|hyper-v|docker/i;
const rank = (n: string) => (!virtual.test(n) && /wi-?fi|wlan|wireless|ethernet/i.test(n) ? 0 : 1);

function lanAddresses() {
  const out: { name: string; ip: string }[] = [];
  for (const [name, list] of Object.entries(os.networkInterfaces()))
    for (const i of list ?? [])
      if (i.family === "IPv4" && !i.internal) out.push({ name, ip: i.address });
  return out.sort((a, b) => rank(a.name) - rank(b.name));
}

export default async function Connect() {
  await requireUser();
  const host = (await headers()).get("host") ?? "localhost:3000";
  const port = host.includes(":") ? host.split(":")[1] : "3000";

  const items = await Promise.all(
    lanAddresses().map(async (a) => {
      const url = `http://${a.ip}:${port}`;
      return { ...a, url, svg: await QRCode.toString(url, { type: "svg", margin: 1 }) };
    }),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 pb-10">
      <Link href="/" className="inline-block py-4 text-sm text-zinc-400 hover:text-zinc-100">
        ← Kembali
      </Link>
      <h1 className="text-2xl font-bold">Sambungkan HP</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Pastikan HP berada di Wi-Fi atau hotspot yang sama dengan laptop ini, lalu scan QR pada
        alamat yang cocok (biasanya berawalan 192.168…). Abaikan adapter virtual.
      </p>

      {items.length === 0 ? (
        <p className="mt-6 text-amber-300">
          Tidak ada alamat jaringan. Sambungkan laptop ke Wi-Fi atau Ethernet dulu.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {items.map((a) => (
            <div key={a.url} className="rounded-lg bg-zinc-900 p-4 text-center">
              <div
                className="mx-auto w-44 rounded-md bg-white p-1 [&>svg]:block [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: a.svg }}
              />
              <p className="mt-3 break-all font-mono text-sm">{a.url}</p>
              <p className="text-xs text-zinc-500">{a.name}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}