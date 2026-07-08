"use client";

import { useMemo, useState } from "react";
import { Library } from "lucide-react";

import { ResourceCard } from "@/components/cards/resource-card";
import { EmptyState } from "@/components/layout/empty-state";
import type { Resource, ResourceType } from "@/lib/types";
import { RESOURCE_TYPE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Client-side filtering keeps the library instant — the list is already loaded. */
export function ResourceLibrary({ resources }: { resources: Resource[] }) {
  const [typeFilter, setTypeFilter] = useState<ResourceType | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const presentTypes = useMemo(() => {
    const types = new Set(resources.map((r) => r.type));
    return (Object.keys(RESOURCE_TYPE_LABELS) as ResourceType[]).filter((t) =>
      types.has(t),
    );
  }, [resources]);

  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const resource of resources) {
      for (const tag of resource.tags) {
        counts.set(tag.name, (counts.get(tag.name) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  }, [resources]);

  const filtered = resources.filter((resource) => {
    if (typeFilter !== "all" && resource.type !== typeFilter) return false;
    if (tagFilter && !resource.tags.some((t) => t.name === tagFilter)) return false;
    return true;
  });

  if (resources.length === 0) {
    return (
      <EmptyState
        icon={Library}
        title="Centre Intelligence is empty"
        description="Upload your curriculum, templates, policies and activity ideas above. Atlas reads and organises everything, and uses it to prepare your weeks."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
          All
        </FilterChip>
        {presentTypes.map((type) => (
          <FilterChip
            key={type}
            active={typeFilter === type}
            onClick={() => setTypeFilter(typeFilter === type ? "all" : type)}
          >
            {RESOURCE_TYPE_LABELS[type]}
          </FilterChip>
        ))}
      </div>

      {topTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground/70">Tags</span>
          {topTags.map((tag) => (
            <FilterChip
              key={tag}
              subtle
              active={tagFilter === tag}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
            >
              {tag}
            </FilterChip>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No matches"
          description="Nothing in the library matches those filters. Clear them to see everything again."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  subtle,
  onClick,
  children,
}: {
  active: boolean;
  subtle?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary/40 bg-primary-soft font-medium text-accent-foreground"
          : subtle
            ? "border-transparent bg-muted text-muted-foreground hover:text-foreground"
            : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
