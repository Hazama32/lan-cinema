import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const TMDB_API_KEY = process.env.TMDB_API_KEY || "2bf4a169b2b52758f4a1329a1b940fd1";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isOwner) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q || !q.trim()) return Response.json({ results: [] });

  try {
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`TMDB error: ${res.statusText}`);
    }
    const data = await res.json();
    return Response.json(data);
  } catch (err: unknown) {
    console.error("Gagal mencari TMDB:", err);
    const errorMessage = err instanceof Error ? err.message : "Gagal mencari TMDB";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
