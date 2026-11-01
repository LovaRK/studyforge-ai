"use server";

import { redirect } from "next/navigation";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";

export async function loadDemoAction(): Promise<void> {
  await requireOwner();
  const source = await container().demo.load();
  redirect(`/sources/${source.id}`);
}
