"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Copy, GitFork, Merge, SquareStack } from "lucide-react";
import { toast } from "sonner";

import { resolveDuplicateAction } from "@/app/actions/resources";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DuplicateDecision, DuplicateSuggestion } from "@/lib/types";

export function DuplicateReviewCard({ suggestion }: { suggestion: DuplicateSuggestion }) {
  const [isPending, startTransition] = useTransition();

  const resolve = (decision: DuplicateDecision) => {
    startTransition(async () => {
      const result = await resolveDuplicateAction({
        feedItemId: suggestion.feedItemId,
        newResourceId: suggestion.newResourceId,
        existingResourceId: suggestion.existingResourceId,
        decision,
      });
      if (!result.ok) {
        toast.error(result.error ?? "The duplicate couldn't be resolved.");
        return;
      }
      toast.success(
        decision === "merge"
          ? "Merged — the existing resource gained a new version."
          : decision === "fork"
            ? "Kept as a fork of the original."
            : "Kept separate.",
      );
    });
  };

  return (
    <Card className={isPending ? "p-5 opacity-50" : "p-5"}>
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
          <Copy className="h-4 w-4 text-primary" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <p className="font-medium leading-snug">
              “
              <Link
                href={`/centre/${suggestion.newResourceId}`}
                className="underline decoration-border underline-offset-4 hover:decoration-foreground"
              >
                {suggestion.newResourceTitle}
              </Link>
              ” looks similar to “
              <Link
                href={`/centre/${suggestion.existingResourceId}`}
                className="underline decoration-border underline-offset-4 hover:decoration-foreground"
              >
                {suggestion.existingResourceTitle}
              </Link>
              ”
            </p>
            <p className="text-sm text-muted-foreground">
              About {Math.round(suggestion.similarity * 100)}% overlap. Merging adds the new
              content to the existing resource as a fresh version — nothing is overwritten.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={isPending} onClick={() => resolve("merge")}>
              <Merge /> Merge
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => resolve("fork")}>
              <GitFork /> Fork
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => resolve("keep_separate")}>
              <SquareStack /> Keep separate
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
