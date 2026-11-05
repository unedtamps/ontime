"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InputGroup, InputField } from "@/components/ui/input-group";
import { api, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/login", { email, password });
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Wrong email or password"
          : "Could not sign in, try again",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="reveal-landing flex min-h-dvh items-center justify-center bg-background text-foreground px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-2)]"
      >
        <div className="mb-1 text-title font-semibold">Ontime</div>
        <div className="mb-6 text-subtitle text-muted-foreground">
          Sign in to record your attendance
        </div>
        <InputGroup className="w-full">
          <InputField
            label="Email"
            index={0}
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@ontime.local"
            autoComplete="email"
          />
          <InputField
            label="Password"
            index={1}
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Your password"
            autoComplete="current-password"
            error={error ?? undefined}
          />
        </InputGroup>
        <Button
          type="submit"
          variant="primary"
          className="mt-6 w-full"
          loading={submitting}
        >
          Sign in
        </Button>
      </form>
    </div>
  );
}
