import { AtlasMarkBreathing } from "@/components/layout/atlas-mark";
import { cn } from "@/lib/utils";

/** Loading state with Atlas's voice: quiet orb + one line of what's happening. */
export function AtlasWorking({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-16 text-center",
        className,
      )}
    >
      <AtlasMarkBreathing className="h-9 w-9" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
