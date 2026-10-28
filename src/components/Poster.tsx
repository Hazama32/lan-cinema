import { hueOf } from "@/lib/format";

export default function Poster({
  id,
  title,
  hasPoster,
  className = "",
}: {
  id: number;
  title: string;
  hasPoster: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative flex aspect-2/3 items-end overflow-hidden bg-zinc-800 ${className}`}
      style={hasPoster ? undefined : { backgroundColor: `hsl(${hueOf(title)} 45% 28%)` }}
    >
      {hasPoster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/poster/${id}`}
          alt={title}
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span className="p-3 font-bold">{title}</span>
      )}
    </div>
  );
}