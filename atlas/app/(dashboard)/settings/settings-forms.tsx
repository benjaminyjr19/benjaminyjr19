"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateCentreNameAction, updateProfileNameAction } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CentreNameForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();
  const isDirty = name.trim() !== initialName;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateCentreNameAction(name);
          if (!result.ok) toast.error(result.error ?? "Couldn't save.");
          else toast.success("Centre name updated.");
        });
      }}
      className="flex items-end gap-3"
    >
      <div className="flex-1 space-y-2">
        <Label htmlFor="centre-name">Centre name</Label>
        <Input id="centre-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {isDirty ? (
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      ) : null}
    </form>
  );
}

export function ProfileNameForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();
  const isDirty = name.trim() !== initialName;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateProfileNameAction(name);
          if (!result.ok) toast.error(result.error ?? "Couldn't save.");
          else toast.success("Profile updated.");
        });
      }}
      className="flex items-end gap-3"
    >
      <div className="flex-1 space-y-2">
        <Label htmlFor="profile-name">Your name</Label>
        <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {isDirty ? (
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      ) : null}
    </form>
  );
}
