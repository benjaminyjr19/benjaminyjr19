import { Inbox } from "lucide-react";

import { DuplicateReviewCard } from "@/components/cards/duplicate-review-card";
import { FeedCard } from "@/components/cards/feed-card";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { listOpenDuplicateSuggestions } from "@/core/duplicates/service";
import { listFeedItems } from "@/core/events/feed";
import { requireWorkspace } from "@/core/workspace/service";
import type { FeedItem } from "@/lib/types";

export const metadata = { title: "Review" };
export const dynamic = "force-dynamic";

const WEEK_TYPES: FeedItem["type"][] = [
  "week_ready",
  "plan_updated",
  "materials_ready",
  "observations_ready",
  "weather_adjustment",
];
const LIBRARY_TYPES: FeedItem["type"][] = [
  "resources_added",
  "contribution",
  "version_created",
  "notice",
];

export default async function ReviewPage() {
  const workspace = await requireWorkspace();
  const [items, duplicates] = await Promise.all([
    listFeedItems(workspace.centre.id, { statuses: ["unread"] }),
    listOpenDuplicateSuggestions(workspace),
  ]);

  const weekItems = items.filter((i) => WEEK_TYPES.includes(i.type));
  const libraryItems = items.filter((i) => LIBRARY_TYPES.includes(i.type));
  const total = weekItems.length + libraryItems.length + duplicates.length;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Review"
        description={
          total > 0
            ? "Everything waiting for your attention, in one quiet place."
            : "Nothing is waiting for you."
        }
      />

      {total === 0 ? (
        <EmptyState
          icon={Inbox}
          title="All clear"
          description="Atlas will let you know when something needs you — a prepared week, a new contribution, or a resource decision."
        />
      ) : (
        <>
          {duplicates.length > 0 ? (
            <Section title="Needs a decision">
              {duplicates.map((suggestion) => (
                <DuplicateReviewCard key={suggestion.feedItemId} suggestion={suggestion} />
              ))}
            </Section>
          ) : null}

          {weekItems.length > 0 ? (
            <Section title="Your week">
              {weekItems.map((item) => (
                <FeedCard key={item.id} item={item} />
              ))}
            </Section>
          ) : null}

          {libraryItems.length > 0 ? (
            <Section title="Centre Intelligence">
              {libraryItems.map((item) => (
                <FeedCard key={item.id} item={item} />
              ))}
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
