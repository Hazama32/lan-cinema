"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";

type Fly = { id: number; emoji: string; x: number };
let counter = 0;

export default function ReactionOverlay() {
  const [flies, setFlies] = useState<Fly[]>([]);

  useEffect(() => {
    const s = getSocket();
    const onReact = (p: { emoji: string }) => {
      const id = ++counter;
      setFlies((f) => [...f.slice(-30), { id, emoji: p.emoji, x: 8 + Math.random() * 84 }]);
      setTimeout(() => setFlies((f) => f.filter((x) => x.id !== id)), 2500);
    };
    s.on("room:react", onReact);
    return () => {
      s.off("room:react", onReact);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {flies.map((f) => (
        <span
          key={f.id}
          className="animate-float-up absolute bottom-16 text-4xl"
          style={{ left: `${f.x}%` }}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  );
}