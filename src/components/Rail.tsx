"use client";

import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "./icons";

export default function Rail({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };
  const arrow =
    "grid size-9 place-items-center rounded-full border border-zinc-700 bg-zinc-900 hover:bg-zinc-800";

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-widest text-brand">{eyebrow}</p>
          )}
          <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
        </div>
        <div className="hidden gap-2 sm:flex">
          <button onClick={() => scroll(-1)} aria-label="Geser kiri" className={arrow}>
            <ChevronLeft />
          </button>
          <button onClick={() => scroll(1)} aria-label="Geser kanan" className={arrow}>
            <ChevronRight />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 scrollbar-width:none sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  );
}