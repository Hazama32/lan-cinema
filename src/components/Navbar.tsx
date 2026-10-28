import Link from "next/link";
import { hueOf } from "@/lib/format";
import JoinRoom from "./JoinRoom";
import ScanButton from "./ScanButton";
import SearchBox from "./SearchBox";
import { PhoneIcon } from "./icons";

export default function Navbar({
  user,
  q,
}: {
  user: { name: string; isOwner: boolean };
  q: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800/70 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-black tracking-widest">
          <span className="text-brand">LAN</span> CINEMA
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="/connect"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            <PhoneIcon className="size-4" />
            Connect Phone
          </Link>
          <Link
            href="/katalog"
            className="rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            Catalog
          </Link>
          {user.isOwner && (
            <>
              <Link
                href="/add"
                className="rounded-md px-3 py-1.5 text-sm text-brand font-semibold hover:bg-white/10 hover:text-white"
              >
                + Add TMDB
              </Link>
              <Link
                href="/convert"
                className="rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                Convert
              </Link>
            </>
          )}
        </nav>

        <div className="order-last w-full md:order-0 md:ml-auto md:w-72">
          <SearchBox initial={q} />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3 md:ml-0">
          <JoinRoom />
          {user.isOwner && <ScanButton />}
          <Link
            href="/profiles"
            title="Switch profile"
            className="flex items-center gap-2 rounded-full bg-zinc-900 py-1 pl-1 pr-3 text-sm hover:bg-zinc-800"
          >
            <span
              className="grid size-7 place-items-center rounded-full text-xs font-bold"
              style={{ backgroundColor: `hsl(${hueOf(user.name)} 45% 32%)` }}
            >
              {user.name[0]}
            </span>
            {user.name}
          </Link>
        </div>
      </div>
    </header>
  );
}