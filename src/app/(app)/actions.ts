"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie } from "@/server/session";

export async function signOutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
