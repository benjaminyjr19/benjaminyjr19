import Link from "next/link";
import {
  BookOpen,
  ClipboardList,
  Eye,
  FileText,
  LayoutTemplate,
  Lightbulb,
  ListTodo,
  Lock,
  Mail,
  ScrollText,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Resource, ResourceType } from "@/lib/types";
import { RESOURCE_TYPE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils/dates";

export const RESOURCE_TYPE_ICONS: Record<ResourceType, LucideIcon> = {
  curriculum: BookOpen,
  lesson_template: LayoutTemplate,
  observation_template: Eye,
  policy: ScrollText,
  activity: Lightbulb,
  weekly_plan: ClipboardList,
  newsletter: Mail,
  resource_list: ListTodo,
  note: StickyNote,
  other: FileText,
};

interface ResourceCardProps {
  resource: Resource;
  className?: string;
}

export function ResourceCard({ resource, className }: ResourceCardProps) {
  const Icon = RESOURCE_TYPE_ICONS[resource.type] ?? FileText;

  return (
    <Link href={`/centre/${resource.id}`} className="group block focus-visible:outline-none">
      <Card
        className={cn(
          "flex h-full flex-col gap-3 p-5 transition-all group-hover:-translate-y-0.5 group-hover:shadow-calm-lg group-focus-visible:ring-2 group-focus-visible:ring-ring",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft">
            <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
          </span>
          {resource.visibility === "private" ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Private
            </span>
          ) : resource.contributed ? (
            <Badge variant="success" className="text-[10px]">
              Contributed
            </Badge>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium leading-snug">{resource.title}</p>
          <p className="text-xs text-muted-foreground">
            {RESOURCE_TYPE_LABELS[resource.type]}
            {resource.currentVersion > 1 ? ` · v${resource.currentVersion}` : ""}
          </p>
        </div>

        {resource.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {resource.tags.slice(0, 3).map((tag) => (
              <Badge key={tag.id} variant="secondary" className="text-[10px] font-normal">
                {tag.name}
              </Badge>
            ))}
            {resource.tags.length > 3 ? (
              <span className="text-[10px] text-muted-foreground/70">
                +{resource.tags.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}

        <p className="text-[11px] text-muted-foreground/70">
          {resource.createdByName ? `${resource.createdByName} · ` : ""}
          {timeAgo(resource.updatedAt)}
        </p>
      </Card>
    </Link>
  );
}
