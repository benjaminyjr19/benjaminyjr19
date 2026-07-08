"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { signInAction, signUpAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [isPending, startTransition] = useTransition();
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("fullName") ?? "");

    startTransition(async () => {
      const result =
        mode === "sign-in"
          ? await signInAction(email, password)
          : await signUpAction(email, password, fullName);
      // Successful sign-in redirects server-side; a result means we stayed here.
      if (result && !result.ok) {
        toast.error(result.error ?? "Something went wrong.");
      } else if (result && mode === "sign-up") {
        setConfirmationSent(true);
      }
    });
  };

  if (confirmationSent) {
    return (
      <p className="rounded-2xl border bg-card p-6 text-center text-sm leading-relaxed text-muted-foreground">
        Check your inbox — we sent a confirmation link. Once confirmed, sign in here.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === "sign-up" ? (
        <div className="space-y-2">
          <Label htmlFor="fullName">Your name</Label>
          <Input id="fullName" name="fullName" placeholder="Sarah Tan" required />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@yourcentre.sg"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          minLength={8}
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending
          ? mode === "sign-in"
            ? "Signing in…"
            : "Creating account…"
          : mode === "sign-in"
            ? "Sign in"
            : "Create account"}
      </Button>

      <button
        type="button"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
        className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {mode === "sign-in"
          ? "New to Atlas? Create an account"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
