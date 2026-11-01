"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function format(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Time left in the session. At zero it asks the server for the next step, which ends the session. */
export function Countdown({ endsAt }: { endsAt: string }) {
  const router = useRouter();
  const end = new Date(endsAt).getTime();
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const remaining = end - Date.now();
      setLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        router.refresh();
      }
    };
    const timer = setInterval(tick, 1000);
    tick();
    return () => clearInterval(timer);
  }, [end, router]);

  return (
    <span className="font-mono text-lg tabular-nums" role="timer" aria-label="Time left">
      {left === null ? "–:––" : format(left)}
    </span>
  );
}
