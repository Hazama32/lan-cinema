import { hueOf } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { selectUser } from "./actions";

export const dynamic = "force-dynamic";

export default async function Profiles() {
  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4">
      <h1 className="mb-8 text-2xl font-bold">Siapa yang menonton?</h1>
      <div className="flex flex-wrap justify-center gap-6">
        {users.map((u) => (
          <form key={u.id} action={selectUser}>
            <input type="hidden" name="userId" value={u.id} />
            <button className="group flex flex-col items-center gap-2">
              <span
                className="flex size-28 items-center justify-center rounded-lg text-4xl font-bold transition group-hover:scale-105"
                style={{ backgroundColor: `hsl(${hueOf(u.name)} 45% 32%)` }}
              >
                {u.name[0]}
              </span>
              <span className="text-zinc-300">{u.name}</span>
              {u.isOwner && <span className="text-xs text-zinc-500">Owner</span>}
            </button>
          </form>
        ))}
      </div>
    </main>
  );
}