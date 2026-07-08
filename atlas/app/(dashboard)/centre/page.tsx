import { HeartHandshake } from "lucide-react";

import { DuplicateReviewCard } from "@/components/cards/duplicate-review-card";
import { ResourceLibrary } from "@/components/cards/resource-library";
import { PageHeader } from "@/components/layout/page-header";
import { UploadManager } from "@/components/upload/upload-manager";
import { listOpenDuplicateSuggestions } from "@/core/duplicates/service";
import { listRecentContributions } from "@/core/resources/repo";
import { listResources } from "@/core/resources/service";
import { requireWorkspace } from "@/core/workspace/service";
import { timeAgo } from "@/lib/utils/dates";

export const metadata = { title: "Centre" };
export const dynamic = "force-dynamic";

const CONTRIBUTION_VERBS: Record<string, string> = {
  uploaded: "uploaded",
  contributed: "contributed",
  edited: "edited",
  merged: "merged content into",
  forked: "forked",
};

export default async function CentrePage() {
  const workspace = await requireWorkspace();
  const [resources, duplicates, contributions] = await Promise.all([
    listResources(workspace.centre.id, workspace.user.id),
    listOpenDuplicateSuggestions(workspace),
    listRecentContributions(workspace.centre.id, 5),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Centre Intelligence"
        description={`Everything ${workspace.centre.name} knows — curriculum, templates, activities and the materials teachers contribute. Your centre data stays private.`}
      />

      <UploadManager />

      {duplicates.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Possible duplicates
          </h2>
          <div className="flex flex-col gap-3">
            {duplicates.slice(0, 2).map((suggestion) => (
              <DuplicateReviewCard key={suggestion.feedItemId} suggestion={suggestion} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Library
        </h2>
        <ResourceLibrary resources={resources} />
      </section>

      {contributions.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent contributions
          </h2>
          <ul className="space-y-2">
            {contributions.map((event) => (
              <li
                key={event.id}
                className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
              >
                <HeartHandshake className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {event.userName ?? "A teacher"}
                  </span>{" "}
                  {CONTRIBUTION_VERBS[event.eventType] ?? event.eventType}{" "}
                  <span className="font-medium text-foreground">
                    {event.resourceTitle ?? "a resource"}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground/70">
                  {timeAgo(event.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
