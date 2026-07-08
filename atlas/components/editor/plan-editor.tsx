"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  BookMarked,
  Check,
  ChevronDown,
  ClipboardCopy,
  Download,
  History,
  Plus,
  Share2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  approvePlanAction,
  contributePlanAction,
  regenerateSectionAction,
  restorePlanVersionAction,
  savePlanAction,
} from "@/app/actions/plans";
import { InlineInput, InlineTextarea, StringListEditor } from "@/components/editor/fields";
import { SectionHeader } from "@/components/editor/section-header";
import { AtlasWorking } from "@/components/layout/atlas-working";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { planToMarkdown } from "@/core/weekly-planning/markdown";
import type {
  PlanSection,
  WeeklyPlanContent,
  WeeklyPlanVersion,
  WeeklyPlanWithContent,
} from "@/lib/types";
import { newId } from "@/lib/utils/ids";
import { formatDateTime, formatWeekRange } from "@/lib/utils/dates";

interface PlanEditorProps {
  plan: WeeklyPlanWithContent;
  versions: WeeklyPlanVersion[];
}

export function PlanEditor({ plan, versions }: PlanEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState<WeeklyPlanContent>(plan.content);
  const [baseline, setBaseline] = useState<WeeklyPlanContent>(plan.content);
  const [status, setStatus] = useState(plan.status);
  const [regenerating, setRegenerating] = useState<PlanSection | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isDirty = useMemo(
    () => JSON.stringify(content) !== JSON.stringify(baseline),
    [content, baseline],
  );

  const update = <K extends keyof WeeklyPlanContent>(
    key: K,
    value: WeeklyPlanContent[K],
  ) => setContent((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    startTransition(async () => {
      const result = await savePlanAction(plan.id, content);
      if (!result.ok) {
        toast.error(result.error ?? "Your edits couldn't be saved.");
        return;
      }
      setBaseline(content);
      toast.success(`Saved as version ${result.data?.version}. Nothing is overwritten.`);
      router.refresh();
    });
  };

  const approve = () => {
    startTransition(async () => {
      if (isDirty) {
        const saved = await savePlanAction(plan.id, content);
        if (!saved.ok) {
          toast.error(saved.error ?? "Your edits couldn't be saved.");
          return;
        }
        setBaseline(content);
      }
      const result = await approvePlanAction(plan.id);
      if (!result.ok) {
        toast.error(result.error ?? "The plan couldn't be approved.");
        return;
      }
      setStatus("approved");
      toast.success("Week approved. Have a lovely week.");
      router.refresh();
    });
  };

  const regenerate = (section: PlanSection, instruction: string | null) => {
    setRegenerating(section);
    startTransition(async () => {
      const result = await regenerateSectionAction(plan.id, section, instruction);
      setRegenerating(null);
      if (!result.ok || !result.data) {
        toast.error(result.error ?? "Atlas couldn't rework that section.");
        return;
      }
      setContent(result.data.content);
      setBaseline(result.data.content);
      toast.success("Atlas reworked the section. The previous version is in history.");
      router.refresh();
    });
  };

  const restore = (versionNumber: number) => {
    startTransition(async () => {
      const result = await restorePlanVersionAction(plan.id, versionNumber);
      if (!result.ok || !result.data) {
        toast.error(result.error ?? "The version couldn't be restored.");
        return;
      }
      setContent(result.data.content);
      setBaseline(result.data.content);
      setHistoryOpen(false);
      toast.success(`Version ${versionNumber} restored.`);
      router.refresh();
    });
  };

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(planToMarkdown(plan, content));
    toast.success("Copied to clipboard as markdown.");
  };

  const downloadMarkdown = () => {
    const blob = new Blob([planToMarkdown(plan, content)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${plan.theme.replace(/[^\w ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const contribute = () => {
    startTransition(async () => {
      const result = await contributePlanAction(plan.id);
      if (!result.ok) {
        toast.error(result.error ?? "The plan couldn't be shared.");
        return;
      }
      toast.success("Plan shared to Centre Intelligence for other teachers.");
    });
  };

  return (
    <div className="space-y-10">
      {/* ── Header ── */}
      <div className="space-y-4">
        <Link
          href="/today"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Today
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Week of {formatWeekRange(plan.weekStart, plan.weekEnd)}
              <span>·</span>
              {plan.className ?? plan.ageGroup}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              {plan.theme}
            </h1>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {status === "approved" ? (
              <Badge variant="success" className="mr-1">
                <Check className="mr-1 h-3 w-3" /> Approved
              </Badge>
            ) : null}

            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
              <History /> History
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Export <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void copyMarkdown()}>
                  <ClipboardCopy /> Copy as markdown
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={downloadMarkdown}>
                  <Download /> Download .md
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => contribute()}>
                  <Share2 /> Share to Centre Intelligence
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {isDirty ? (
              <Button size="sm" variant="secondary" onClick={save} disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            ) : null}

            {status !== "approved" ? (
              <Button size="sm" onClick={approve} disabled={isPending}>
                <Check /> Approve week
              </Button>
            ) : null}
          </div>
        </div>

        {isDirty ? (
          <p className="text-xs text-muted-foreground">
            Unsaved changes — saving creates a new version, nothing is overwritten.
          </p>
        ) : null}
      </div>

      {/* ── Overview ── */}
      <section className="space-y-3">
        <SectionHeader
          section="overview"
          onRegenerate={regenerate}
          isRegenerating={regenerating === "overview"}
        />
        {regenerating === "overview" ? (
          <AtlasWorking message="Atlas is rethinking the overview…" className="py-8" />
        ) : (
          <InlineTextarea
            value={content.overview}
            ariaLabel="Weekly overview"
            onChange={(value) => update("overview", value)}
            className="text-[15px] text-foreground/90"
          />
        )}
      </section>

      {/* ── Learning goals ── */}
      <section className="space-y-3">
        <SectionHeader
          section="learningGoals"
          onRegenerate={regenerate}
          isRegenerating={regenerating === "learningGoals"}
        />
        {regenerating === "learningGoals" ? (
          <AtlasWorking message="Atlas is refreshing the learning goals…" className="py-8" />
        ) : (
          <StringListEditor
            items={content.learningGoals}
            onChange={(items) => update("learningGoals", items)}
            addLabel="Add goal"
          />
        )}
      </section>

      {/* ── Days ── */}
      <section className="space-y-4">
        <SectionHeader
          section="days"
          onRegenerate={regenerate}
          isRegenerating={regenerating === "days"}
        />
        {regenerating === "days" ? (
          <AtlasWorking message="Atlas is replanning the week…" className="py-8" />
        ) : (
          <div className="space-y-4">
            {content.days.map((day, dayIndex) => (
              <Card key={day.date} className="space-y-4 p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {day.label}
                    </p>
                    <InlineInput
                      value={day.title}
                      ariaLabel={`${day.label} title`}
                      onChange={(value) =>
                        update(
                          "days",
                          content.days.map((d, i) =>
                            i === dayIndex ? { ...d, title: value } : d,
                          ),
                        )
                      }
                      className="text-[17px] font-semibold tracking-tight"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {day.blocks.map((block, blockIndex) => (
                    <div
                      key={block.id}
                      className="group space-y-1 border-l-2 border-primary-soft pl-4"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="quiet" className="text-[10px] capitalize">
                          {block.period}
                        </Badge>
                        <InlineInput
                          value={block.title}
                          ariaLabel="Block title"
                          onChange={(value) =>
                            update(
                              "days",
                              content.days.map((d, i) =>
                                i === dayIndex
                                  ? {
                                      ...d,
                                      blocks: d.blocks.map((b, j) =>
                                        j === blockIndex ? { ...b, title: value } : b,
                                      ),
                                    }
                                  : d,
                              ),
                            )
                          }
                          className="text-sm font-medium"
                        />
                      </div>
                      <InlineTextarea
                        value={block.description}
                        ariaLabel="Block description"
                        onChange={(value) =>
                          update(
                            "days",
                            content.days.map((d, i) =>
                              i === dayIndex
                                ? {
                                    ...d,
                                    blocks: d.blocks.map((b, j) =>
                                      j === blockIndex ? { ...b, description: value } : b,
                                    ),
                                  }
                                : d,
                            ),
                          )
                        }
                        className="text-sm text-muted-foreground"
                      />
                      {block.materials.length > 0 ? (
                        <p className="px-1.5 text-xs text-muted-foreground/70">
                          Materials: {block.materials.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Materials ── */}
      <section className="space-y-3">
        <SectionHeader
          section="materials"
          anchor="materials"
          onRegenerate={regenerate}
          isRegenerating={regenerating === "materials"}
        />
        {regenerating === "materials" ? (
          <AtlasWorking message="Atlas is rebuilding the checklist…" className="py-8" />
        ) : (
          <Card className="divide-y p-2">
            {content.materials.map((item, index) => (
              <label
                key={item.id}
                className="group flex cursor-pointer items-center gap-3 px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={item.ready}
                  onChange={(e) =>
                    update(
                      "materials",
                      content.materials.map((m, i) =>
                        i === index ? { ...m, ready: e.target.checked } : m,
                      ),
                    )
                  }
                  className="h-4 w-4 shrink-0 accent-[hsl(252,62%,62%)]"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={
                      item.ready
                        ? "block text-sm text-muted-foreground line-through decoration-border"
                        : "block text-sm"
                    }
                  >
                    {item.item}
                  </span>
                  {(item.detail || item.day) && (
                    <span className="block text-xs text-muted-foreground/70">
                      {[item.day, item.detail].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <button
                  aria-label="Remove material"
                  onClick={(e) => {
                    e.preventDefault();
                    update(
                      "materials",
                      content.materials.filter((_, i) => i !== index),
                    );
                  }}
                  className="rounded-full p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </label>
            ))}
            <div className="px-4 py-3">
              <AddMaterialInput
                onAdd={(item) =>
                  update("materials", [
                    ...content.materials,
                    { id: newId(), item, detail: null, day: null, ready: false },
                  ])
                }
              />
            </div>
          </Card>
        )}
      </section>

      {/* ── Observation opportunities ── */}
      <section className="space-y-3">
        <SectionHeader
          section="observationOpportunities"
          anchor="observations"
          onRegenerate={regenerate}
          isRegenerating={regenerating === "observationOpportunities"}
        />
        {regenerating === "observationOpportunities" ? (
          <AtlasWorking message="Atlas is looking for observation moments…" className="py-8" />
        ) : (
          <div className="space-y-3">
            {content.observationOpportunities.map((obs, index) => (
              <Card key={obs.id} className="space-y-1.5 p-5">
                <div className="flex items-center justify-between gap-2">
                  <InlineInput
                    value={obs.focus}
                    ariaLabel="Observation focus"
                    onChange={(value) =>
                      update(
                        "observationOpportunities",
                        content.observationOpportunities.map((o, i) =>
                          i === index ? { ...o, focus: value } : o,
                        ),
                      )
                    }
                    className="text-sm font-medium"
                  />
                  {obs.day ? (
                    <Badge variant="quiet" className="shrink-0 text-[10px]">
                      {obs.day}
                    </Badge>
                  ) : null}
                </div>
                <InlineTextarea
                  value={obs.prompt}
                  ariaLabel="Observation prompt"
                  onChange={(value) =>
                    update(
                      "observationOpportunities",
                      content.observationOpportunities.map((o, i) =>
                        i === index ? { ...o, prompt: value } : o,
                      ),
                    )
                  }
                  className="text-sm text-muted-foreground"
                />
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Rainy-day alternatives ── */}
      <section className="space-y-3">
        <SectionHeader
          section="rainyDayAlternatives"
          anchor="rainy-day"
          onRegenerate={regenerate}
          isRegenerating={regenerating === "rainyDayAlternatives"}
        />
        {regenerating === "rainyDayAlternatives" ? (
          <AtlasWorking message="Atlas is planning for wet weather…" className="py-8" />
        ) : (
          <div className="space-y-3">
            {content.rainyDayAlternatives.map((alt, index) => (
              <Card key={alt.id} className="space-y-1.5 p-5">
                <div className="flex items-center justify-between gap-2">
                  <InlineInput
                    value={alt.title}
                    ariaLabel="Alternative title"
                    onChange={(value) =>
                      update(
                        "rainyDayAlternatives",
                        content.rainyDayAlternatives.map((a, i) =>
                          i === index ? { ...a, title: value } : a,
                        ),
                      )
                    }
                    className="text-sm font-medium"
                  />
                  {alt.replaces ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground/70">
                      replaces {alt.replaces}
                    </span>
                  ) : null}
                </div>
                <InlineTextarea
                  value={alt.description}
                  ariaLabel="Alternative description"
                  onChange={(value) =>
                    update(
                      "rainyDayAlternatives",
                      content.rainyDayAlternatives.map((a, i) =>
                        i === index ? { ...a, description: value } : a,
                      ),
                    )
                  }
                  className="text-sm text-muted-foreground"
                />
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Reflection prompts ── */}
      <section className="space-y-3">
        <SectionHeader
          section="reflectionPrompts"
          onRegenerate={regenerate}
          isRegenerating={regenerating === "reflectionPrompts"}
        />
        {regenerating === "reflectionPrompts" ? (
          <AtlasWorking message="Atlas is writing reflection prompts…" className="py-8" />
        ) : (
          <StringListEditor
            items={content.reflectionPrompts}
            onChange={(items) => update("reflectionPrompts", items)}
            addLabel="Add prompt"
          />
        )}
      </section>

      {/* ── Sources ── */}
      <section id="sources" className="scroll-mt-24 space-y-3">
        <div className="flex items-center gap-2">
          <BookMarked className="h-4 w-4 text-primary" strokeWidth={2} />
          <h2 className="text-lg font-semibold tracking-tight">What Atlas used</h2>
        </div>
        {content.sources.length > 0 ? (
          <div className="space-y-2">
            {content.sources.map((source) => (
              <Link
                key={source.resourceId}
                href={`/centre/${source.resourceId}`}
                className="block rounded-xl border bg-card px-4 py-3 transition-all hover:shadow-calm"
              >
                <p className="text-sm font-medium">{source.title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{source.usage}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Atlas prepared this week from general early-childhood practice — add curriculum
            and templates to Centre Intelligence and future weeks will draw on them.
          </p>
        )}
        <p className="text-xs text-muted-foreground/70">
          Atlas&apos;s work is never final — everything above is yours to edit.
        </p>
      </section>

      {/* ── History ── */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version history</DialogTitle>
            <DialogDescription>
              Every save, rework and approval is kept. Restoring copies an older version
              forward — nothing is lost.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {versions.map((version) => (
              <li
                key={version.id}
                className="flex items-center gap-3 rounded-xl border px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    Version {version.versionNumber}
                    {version.versionNumber === plan.currentVersion ? (
                      <span className="ml-2 text-xs font-normal text-success">Current</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {version.createdByAtlas ? "Atlas" : (version.createdByName ?? "Teacher")} ·{" "}
                    {formatDateTime(version.createdAt)}
                    {version.changeSummary ? ` · ${version.changeSummary}` : ""}
                  </p>
                </div>
                {version.versionNumber !== plan.currentVersion ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => restore(version.versionNumber)}
                  >
                    Restore
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddMaterialInput({ onAdd }: { onAdd: (item: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onAdd(value.trim());
        setValue("");
      }}
      className="flex items-center gap-2"
    >
      <Plus className="h-3.5 w-3.5 text-muted-foreground/50" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add an item…"
        className="w-full bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none"
      />
    </form>
  );
}
