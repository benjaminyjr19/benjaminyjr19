import { cn } from "@/lib/utils";

/** The Atlas mark — a quiet gradient orb. */
export function AtlasMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative h-7 w-7 rounded-full bg-gradient-to-br from-[hsl(252,80%,74%)] via-[hsl(252,62%,62%)] to-[hsl(266,60%,52%)] shadow-[0_2px_8px_-2px_rgba(109,86,224,0.5)]",
        className,
      )}
    >
      <div className="absolute left-[18%] top-[14%] h-[38%] w-[38%] rounded-full bg-white/50 blur-[3px]" />
    </div>
  );
}

/** Breathing variant used while Atlas is working. */
export function AtlasMarkBreathing({ className }: { className?: string }) {
  return <AtlasMark className={cn("animate-breathe", className)} />;
}
