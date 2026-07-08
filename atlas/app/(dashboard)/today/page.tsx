import Link from "next/link";
import { ArrowRight, CalendarCheck, Sparkles } from "lucide-react";

import { FeedCard } from "@/components/cards/feed-card";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listFeedItems } from "@/core/events/feed";
import { getCurrentPlan } from "@/core/weekly-planning/service";
import { requireWorkspace } from "@/core/workspace/service";
import { formatWeekRange, greetingForHour, hourInTimezone } from "@/lib/utils/dates";
import { firstName, pluralize } from "@/lib/utils/text";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const workspace = await requireWorkspace();
  const [feedItems, currentPlan] = await Promise.all([
    listFeedItems(workspace.centre.id, { statuses: ["unread"], limit: 12 }),
    getCurrentPlan(workspace),
  ]);

  const greeting = greetingForHour(hourInTimezone(workspace.centre.timezone));

  // The week hero already answers "is my week ready" — keep the feed for the rest.
  const briefingItems = (
    currentPlan ? feedItems.filter((item) => item.type !== "week_ready") : feedItems
  ).slice(0, 5);

  const reviewCount = feedItems.length;

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-balance">
          {greeting}, {firstName(workspace.user.fullName)}.
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {reviewCount > 0
            ? `Atlas worked while you were away — ${reviewCount} ${pluralize(reviewCount, "thing")} ready for your review.`
            : "Atlas worked while you were away. Everything is in order."}
        </p>
      </header>

      {currentPlan ? (
        <Link href={`/week/${currentPlan.id}`} className="group block focus-visible:outline-none">
          <Card className="relative overflow-hidden p-6 transition-all group-hover:shadow-calm-lg group-focus-visible:ring-2 group-focus-visible:ring-ring">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary-soft blur-2xl"
            />
            <div className="relative flex items-start justify-between gap-6">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-primary" strokeWidth={2} />
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Week of {formatWeekRange(currentPlan.weekStart, currentPlan.weekEnd)}
                  </span>
                  {currentPlan.status === "approved" ? (
                    <Badge variant="success">Approved</Badge>
                  ) : (
                    <Badge>Ready for review</Badge>
                  )}
                </div>
                <h2 className="text-lg font-semibold leading-snug tracking-tight">
                  {currentPlan.theme}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {currentPlan.className ?? currentPlan.ageGroup}
                  {currentPlan.status === "approved"
                    ? " · Reviewed and approved. Have a lovely week."
                    : " · Atlas prepared the full week from your centre's materials — about 6 minutes to review."}
                </p>
              </div>
              <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft transition-transform group-hover:translate-x-0.5">
                <ArrowRight className="h-4 w-4 text-primary" />
              </span>
            </div>
          </Card>
        </Link>
      ) : (
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <h2 className="font-semibold tracking-tight">No week prepared yet</h2>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                Tell Atlas the theme and class, and it will prepare the upcoming week from
                your centre&apos;s own curriculum and resources.
              </p>
            </div>
            <Button asChild>
              <Link href="/week">Prepare my week</Link>
            </Button>
          </div>
        </Card>
      )}

      <section className="space-y-4">
        {briefingItems.length > 0 ? (
          <>
            <div className="flex flex-col gap-3">
              {briefingItems.map((item) => (
                <FeedCard key={item.id} item={item} />
              ))}
            </div>
            <div className="flex justify-center pt-1">
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link href="/review">
                  See everything in Review <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="All caught up"
            description="Nothing needs your attention right now. Atlas will add anything new here as it happens."
          />
        )}
      </section>

      <p className="pt-2 text-center text-xs text-muted-foreground/60">
        Your centre data stays private. Atlas never trains on it.
      </p>
    </div>
  );
}
