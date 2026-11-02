"use client";

import { useActionState } from "react";
import { buttonClass, inputClass, Spinner } from "@/components/ui";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          aria-describedby={state.error ? "login-error" : undefined}
          className={`${inputClass} py-2 text-base`}
        />
      </div>
      {state.error && (
        <p id="login-error" role="alert" className="animate-[rise_240ms_ease-out] text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full py-2 text-base`}>
        {pending && <Spinner />}
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
