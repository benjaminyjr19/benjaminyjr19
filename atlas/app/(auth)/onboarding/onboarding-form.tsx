"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { createCentreAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OnboardingForm() {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("centreName") ?? "");
    startTransition(async () => {
      const result = await createCentreAction(name);
      if (result && !result.ok) toast.error(result.error ?? "Something went wrong.");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="centreName">What&apos;s your centre called?</Label>
        <Input
          id="centreName"
          name="centreName"
          placeholder="Sunny Grove Preschool"
          autoFocus
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Setting up your centre…" : "Create my centre"}
      </Button>
      <p className="text-center text-xs leading-relaxed text-muted-foreground/80">
        You can invite colleagues later. Your centre data stays private.
      </p>
    </form>
  );
}
