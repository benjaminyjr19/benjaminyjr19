"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CloudUpload, FileWarning, StickyNote } from "lucide-react";
import { toast } from "sonner";

import { createNoteAction, resolveDuplicateAction, setResourceSharingAction } from "@/app/actions/resources";
import { AtlasMarkBreathing } from "@/components/layout/atlas-mark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const WORKING_MESSAGES = [
  "Atlas is reading your documents…",
  "Atlas is classifying and tagging…",
  "Atlas is checking for similar resources…",
];

interface UploadedResource {
  id: string;
  title: string;
  duplicate: { resourceId: string; title: string; similarity: number } | null;
  parserWarning: string | null;
}

interface UploadFailure {
  filename: string;
  error: string;
}

/** A resource waiting for the teacher's decisions after Atlas filed it. */
interface DecisionItem {
  resource: UploadedResource;
  step: "duplicate" | "share";
}

export function UploadManager() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [workingMessage, setWorkingMessage] = useState(WORKING_MESSAGES[0]);
  const [failures, setFailures] = useState<UploadFailure[]>([]);
  const [queue, setQueue] = useState<DecisionItem[]>([]);
  const [isNoteOpen, setIsNoteOpen] = useState(false);

  // Rotate the working copy so the wait feels alive.
  useEffect(() => {
    if (!isWorking) return;
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % WORKING_MESSAGES.length;
      setWorkingMessage(WORKING_MESSAGES[index]);
    }, 1400);
    return () => clearInterval(interval);
  }, [isWorking]);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    setIsWorking(true);
    setFailures([]);
    setWorkingMessage(WORKING_MESSAGES[0]);

    try {
      const formData = new FormData();
      for (const file of list) formData.append("files", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      const data = (await response.json()) as {
        results: Array<
          | {
              ok: true;
              filename: string;
              resource: { id: string; title: string };
              duplicate: { resourceId: string; title: string; similarity: number } | null;
              parserWarning: string | null;
            }
          | { ok: false; filename: string; error: string }
        >;
      };

      const decisions: DecisionItem[] = [];
      const failed: UploadFailure[] = [];
      let succeeded = 0;

      for (const result of data.results) {
        if (result.ok) {
          succeeded += 1;
          decisions.push({
            resource: {
              id: result.resource.id,
              title: result.resource.title,
              duplicate: result.duplicate,
              parserWarning: result.parserWarning,
            },
            step: result.duplicate ? "duplicate" : "share",
          });
        } else {
          failed.push({ filename: result.filename, error: result.error });
        }
      }

      if (succeeded > 0) {
        toast.success(
          succeeded === 1
            ? "Atlas filed your document into Centre Intelligence."
            : `Atlas filed ${succeeded} documents into Centre Intelligence.`,
        );
      }
      setFailures(failed);
      setQueue(decisions);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("The upload didn't go through. Please try again.");
    } finally {
      setIsWorking(false);
    }
  };

  const current = queue[0] ?? null;

  const advance = () => {
    setQueue((prev) => prev.slice(1));
    router.refresh();
  };

  const handleDuplicateDecision = async (decision: "merge" | "fork" | "keep_separate") => {
    if (!current?.resource.duplicate) return;
    const result = await resolveDuplicateAction({
      feedItemId: null,
      newResourceId: current.resource.id,
      existingResourceId: current.resource.duplicate.resourceId,
      decision,
    });
    if (!result.ok) {
      toast.error(result.error ?? "That didn't work — you can decide later in Review.");
      advance();
      return;
    }
    if (decision === "merge") {
      toast.success(`Merged into “${current.resource.duplicate.title}”.`);
      advance(); // merged content lives in the existing resource; no share step
    } else {
      setQueue((prev) => [
        { resource: prev[0].resource, step: "share" },
        ...prev.slice(1),
      ]);
    }
  };

  const handleShareDecision = async (share: boolean) => {
    if (!current) return;
    const result = await setResourceSharingAction(current.resource.id, share);
    if (!result.ok) {
      toast.error(result.error ?? "Sharing preference couldn't be saved.");
    } else if (share) {
      toast.success("Shared with your centre. Thank you for contributing.");
    } else {
      toast.success("Kept private — only you can see it.");
    }
    advance();
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload documents to Centre Intelligence"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          void uploadFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-8 py-10 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isDragging
            ? "border-primary bg-primary-soft/60"
            : "border-border bg-card/60 hover:border-primary/40 hover:bg-primary-soft/30",
        )}
      >
        {isWorking ? (
          <>
            <AtlasMarkBreathing className="h-8 w-8" />
            <p className="text-sm text-muted-foreground">{workingMessage}</p>
          </>
        ) : (
          <>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft">
              <CloudUpload className="h-5 w-5 text-primary" strokeWidth={1.8} />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Drop documents here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, Word, PowerPoint, images and text — Atlas reads, files and tags them.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setIsNoteOpen(true);
              }}
            >
              <StickyNote /> Or write a quick note
            </Button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,image/*"
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {failures.length > 0 ? (
        <div className="mt-3 space-y-2">
          {failures.map((failure) => (
            <p
              key={failure.filename}
              className="flex items-center gap-2 rounded-xl bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive"
            >
              <FileWarning className="h-3.5 w-3.5 shrink-0" />
              {failure.filename}: {failure.error}
            </p>
          ))}
        </div>
      ) : null}

      {/* Post-upload decisions, one calm question at a time. */}
      <Dialog open={current !== null} onOpenChange={(open) => !open && advance()}>
        <DialogContent>
          {current?.step === "duplicate" && current.resource.duplicate ? (
            <>
              <DialogHeader>
                <DialogTitle>This looks similar to “{current.resource.duplicate.title}”</DialogTitle>
                <DialogDescription>
                  “{current.resource.title}” overlaps with an existing resource (~
                  {Math.round(current.resource.duplicate.similarity * 100)}%). Merging adds
                  your content to it as a new version — nothing is overwritten.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-start">
                <Button onClick={() => void handleDuplicateDecision("merge")}>Merge</Button>
                <Button variant="outline" onClick={() => void handleDuplicateDecision("fork")}>
                  Fork
                </Button>
                <Button variant="ghost" onClick={() => void handleDuplicateDecision("keep_separate")}>
                  Keep separate
                </Button>
              </DialogFooter>
            </>
          ) : current ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  “{current.resource.title}” is filed
                </DialogTitle>
                <DialogDescription>
                  {current.resource.parserWarning
                    ? `${current.resource.parserWarning} `
                    : ""}
                  Would you like other teachers in your centre to benefit from this?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-start">
                <Button onClick={() => void handleShareDecision(true)}>
                  Save to Centre Intelligence
                </Button>
                <Button variant="outline" onClick={() => void handleShareDecision(false)}>
                  Keep private
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <NoteDialog
        open={isNoteOpen}
        onOpenChange={setIsNoteOpen}
        onCreated={(resourceId, title) => {
          setQueue((prev) => [
            ...prev,
            {
              resource: { id: resourceId, title, duplicate: null, parserWarning: null },
              step: "share",
            },
          ]);
          router.refresh();
        }}
      />
    </>
  );
}

function NoteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (resourceId: string, title: string) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const content = String(form.get("content") ?? "").trim();
    if (!content) {
      toast.error("Write something first.");
      return;
    }
    setIsSaving(true);
    const result = await createNoteAction({ title, content });
    setIsSaving(false);
    if (!result.ok || !result.data) {
      toast.error(result.error ?? "The note couldn't be saved.");
      return;
    }
    onOpenChange(false);
    toast.success("Note saved — Atlas filed and tagged it.");
    onCreated(result.data.resourceId, title || "Untitled note");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick note</DialogTitle>
          <DialogDescription>
            An activity idea, a reminder, anything worth keeping. Atlas files it like any
            other resource.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-title">Title</Label>
            <Input id="note-title" name="title" placeholder="Shadow hunt idea" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-content">Note</Label>
            <Textarea
              id="note-content"
              name="content"
              rows={5}
              placeholder="Trace shadows with chalk in morning light, come back after outdoor play…"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Save note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
