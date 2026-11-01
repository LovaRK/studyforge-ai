import { requireOwner } from "@/server/session";

export default async function HomePage() {
  await requireOwner();

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="max-w-prose text-muted">
        Your private study space is ready. Sources, the review queue and the library will appear here.
      </p>
    </section>
  );
}
