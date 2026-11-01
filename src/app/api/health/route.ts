import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { container } from "@/server/container";
import { isSignedIn } from "@/server/session";

/** Signed-in health check: confirms the app can reach Postgres. */
export async function GET() {
  if (!(await isSignedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await container().db.execute(sql`select 1`);
  return NextResponse.json({ status: "ok" });
}
