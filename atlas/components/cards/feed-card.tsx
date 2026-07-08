"use client";

import Link from "next/link";
import { useTransition } from "react";
import {
  CalendarCheck,
  Check,
  CloudRain,
  Copy,
  Eye,
  FilePlus2,
  HeartHandshake,
  History,
  ListChecks,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { setFeedStatusAction } from "@/app/actions/feed";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { FeedItem, FeedItemType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils/dates";

const TYPE_ICONS: Record<FeedItemType, LucideIcon> = {
  week_ready: CalendarCheck,
  plan_updated: RefreshCw,
  materials_ready: ListChecks,
  observations_ready: Eye,
  weather_adjustment: CloudRain,
  resources_added: FilePlus2,
  duplicate_found: Copy,
  contribution: HeartHandshake,
  version_created: History,
  notice: Sparkles,
};

interface FeedCardProps {
  item: FeedItem;
  /** Hide the quiet dismiss control (e.g. on Review where items resolve differently). */
  dismissable?: boolean;
  className?: string;
}

export function FeedCard({ item, dismissable = true, className }: FeedCardProps) {
  const [isPending, startTransition] = useTransition();
  const Icon = TYPE_ICONS[item.type] ?? Sparkles;

  const markReviewed = () => {
    startTransition(async () => {
      const result = await setFeedStatusAction(item.id, "reviewed");
      if (!result.ok) toast.error(result.error ?? "Couldn't update the item.");
    });
  };

  return (
    <Card
      className={cn(
        "group flex items-start gap-4 p-5 transition-all hover:shadow-calm-lg",
        isPending && "opacity-50",
        className,
      )}
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
        <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium leading-snug">{item.title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
        <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground/80">
          {item.reviewMinutes ? <span>~{item.reviewMinutes} min review</span> : null}
          <span>{timeAgo(item.createdAt)}</span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2 self-center">
        {item.actionHref && item.actionLabel ? (
          <Button asChild size="sm" variant="secondary" className="whitespace-nowrap">
            <Link href={item.actionHref}>{item.actionLabel}</Link>
          </Button>
        ) : null}
        {dismissable && item.status === "unread" ? (
          <button
            onClick={markReviewed}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground/70 opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Check className="h-3 w-3" /> Looks good
          </button>
        ) : null}
      </div>
    </Card>
  );
}
