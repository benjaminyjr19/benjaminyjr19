"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { PlanSection } from "@/lib/types";
import { PLAN_SECTION_LABELS } from "@/lib/types";

interface SectionHeaderProps {
  section: PlanSection;
  onRegenerate: (section: PlanSection, instruction: string | null) => void;
  isRegenerating: boolean;
  anchor?: string;
}

/** Section title with the quiet "let Atlas rework this" affordance. */
export function SectionHeader({
  section,
  onRegenerate,
  isRegenerating,
  anchor,
}: SectionHeaderProps) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");

  const submit = () => {
    setOpen(false);
    onRegenerate(section, instruction.trim() || null);
    setInstruction("");
  };

  return (
    <div id={anchor} className="flex scroll-mt-24 items-center justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight">
        {PLAN_SECTION_LABELS[section]}
      </h2>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        disabled={isRegenerating}
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {isRegenerating ? "Reworking…" : "Rework"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Rework “{PLAN_SECTION_LABELS[section]}”
            </DialogTitle>
            <DialogDescription>
              Atlas will redo just this section, keeping the rest of your plan untouched.
              The current version stays in history.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Anything Atlas should keep in mind? (optional) — e.g. “more outdoor time” or “simpler materials”"
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Rework section</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
