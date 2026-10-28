"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { USER_COOKIE } from "@/lib/session";

export async function selectUser(formData: FormData) {
  const id = Number(formData.get("userId"));
  const user = Number.isInteger(id)
    ? await prisma.user.findUnique({ where: { id } })
    : null;
  if (!user) redirect("/profiles");

  (await cookies()).set(USER_COOKIE, String(user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}