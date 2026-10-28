import { scanLibrary } from "@/lib/scanner";
import { getCurrentUser } from "@/lib/session";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user?.isOwner)
    return Response.json({ error: "Hanya Owner yang boleh memindai" }, { status: 403 });
  try {
    const result = await scanLibrary();
    result.warnings.forEach((w) => console.warn("[scan]", w));
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}