"use client";

import { useFormStatus } from "react-dom";
import { buttonClass, Spinner } from "@/components/ui";
import { loadDemoAction } from "./load-demo-action";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className={buttonClass.secondary} disabled={pending}>
      {pending && <Spinner />}
      {pending ? "Loading demo…" : "Load original demo note"}
    </button>
  );
}

export function DemoButton() {
  return (
    <form action={loadDemoAction}>
      <Submit />
    </form>
  );
}
