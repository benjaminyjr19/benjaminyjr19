"use client";

import { useEffect } from "react";

import { AtlasMark } from "@/components/layout/atlas-mark";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <AtlasMark className="h-9 w-9 opacity-60" />
      <h2 className="text-lg font-semibold tracking-tight">Something went wrong</h2>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        Atlas hit a snag loading this page. Nothing was lost — try again in a moment.
      </p>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
