import Link from "next/link";

import { AtlasMark } from "@/components/layout/atlas-mark";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <AtlasMark className="h-9 w-9 opacity-60" />
      <h2 className="text-lg font-semibold tracking-tight">Nothing here</h2>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        This page doesn&apos;t exist — it may have been moved or the link is old.
      </p>
      <Button asChild variant="secondary">
        <Link href="/today">Back to Today</Link>
      </Button>
    </div>
  );
}
