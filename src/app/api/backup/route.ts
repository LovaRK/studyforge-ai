import { NextResponse } from "next/server";
import { container } from "@/server/container";
import { isSignedIn } from "@/server/session";

export async function GET() {
  if (!(await isSignedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const backup = await container().backup.export();
  const date = backup.exportedAt.slice(0, 10);
  return NextResponse.json(backup, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="studyforge-backup-${date}.json"`,
    },
  });
}
