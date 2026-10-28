"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "./icons";

export default function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const term = value.trim();
    if (term === initial) return;
    const t = setTimeout(() => {
      router.replace(term ? `/?q=${encodeURIComponent(term)}` : "/");
    }, 300);
    return () => clearTimeout(t);
  }, [value, initial, router]);

  return (
    <label className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-1.5 focus-within:border-brand">
      <SearchIcon className="size-4 shrink-0 text-zinc-500" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Cari judul atau tahun…"
        className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
      />
    </label>
  );
}