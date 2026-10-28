import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

export const USER_COOKIE = "lc_user";

export async function getCurrentUser() {
  const id = Number((await cookies()).get(USER_COOKIE)?.value);
  if (!Number.isInteger(id) || id < 1) return null;
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, isOwner: true },
  });
}

// Untuk halaman: belum pilih profil -> arahkan ke /profiles
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/profiles");
  return user;
}