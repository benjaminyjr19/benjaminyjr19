"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { prepareWeekAction } from "@/app/actions/plans";
import { AtlasWorking } from "@/components/layout/atlas-working";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const AGE_GROUPS = ["N1", "N2", "K1", "K2"] as const;

interface PrepareWeekFormProps {
  defaultWeekStart: string; // ISO Monday
  defaultWeekEnd: string; // ISO Friday
  weekRangeLabel: string;
}

export function PrepareWeekForm({
  defaultWeekStart,
  defaultWeekEnd,
  weekRangeLabel,
}: PrepareWeekFormProps) {
  const router = useRouter();
  const [ageGroup, setAgeGroup] = useState<string>("K1");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const theme = String(form.get("theme") ?? "");
    const className = String(form.get("className") ?? "");
    const notes = String(form.get("notes") ?? "");

    startTransition(async () => {
      const result = await prepareWeekAction({
        weekStart: defaultWeekStart,
        weekEnd: defaultWeekEnd,
        theme,
        ageGroup,
        className: className || null,
        teacherNotes: notes || null,
      });
      if (!result.ok || !result.data) {
        toast.error(result.error ?? "Atlas couldn't prepare the week.");
        return;
      }
      toast.success("Your week is ready to review.");
      router.push(`/week/${result.data.planId}`);
    });
  };

  if (isPending) {
    return (
      <Card className="p-6">
        <AtlasWorking message="Atlas is preparing your week from your centre's curriculum and resources…" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <h2 className="font-semibold tracking-tight">Prepare the week of {weekRangeLabel}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Atlas plans the full week from your centre&apos;s own curriculum, templates and
            resources — you review and adjust.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="theme">Theme</Label>
          <Input
            id="theme"
            name="theme"
            placeholder="e.g. Little Gardeners: How Plants Grow"
            required
            autoFocus
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Age group</Label>
            <div className="flex gap-1.5">
              {AGE_GROUPS.map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setAgeGroup(group)}
                  className={
                    ageGroup === group
                      ? "rounded-full border border-primary/40 bg-primary-soft px-3.5 py-1.5 text-sm font-medium text-accent-foreground"
                      : "rounded-full border bg-card px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                  }
                >
                  {group}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="className">Class name (optional)</Label>
            <Input id="className" name="className" placeholder="e.g. K1 Sunbeams" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Anything Atlas should know? (kept private to you)</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="e.g. Two children are fascinated by worms — work them in. Field trip Thursday morning."
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground/70">
            Atlas cites every centre resource it uses.
          </p>
          <Button type="submit">Prepare my week</Button>
        </div>
      </form>
    </Card>
  );
}
