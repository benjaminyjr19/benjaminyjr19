"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, FileArchive, History, Lock, Pencil, Users, X } from "lucide-react";
import { toast } from "sonner";

import {
  editResourceTextAction,
  restoreResourceVersionAction,
  setResourceSharingAction,
  updateResourceTagsAction,
} from "@/app/actions/resources";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Resource, ResourceVersion } from "@/lib/types";
import { RESOURCE_TYPE_LABELS } from "@/lib/types";
import { formatDateTime } from "@/lib/utils/dates";

interface ResourceEditorProps {
  resource: Resource;
  versions: ResourceVersion[];
  latestText: string;
  isOwner: boolean;
}

export function ResourceEditor({
  resource,
  versions,
  latestText,
  isOwner,
}: ResourceEditorProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(resource.title);
  const [text, setText] = useState(latestText);
  const [tagNames, setTagNames] = useState(resource.tags.map((t) => t.name));
  const [newTag, setNewTag] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const result = await editResourceTextAction({
        resourceId: resource.id,
        title,
        text,
        changeNote: null,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Your edit couldn't be saved.");
        return;
      }
      toast.success(`Saved as version ${result.data?.version}. Earlier versions are kept.`);
      setIsEditing(false);
      // Spec moment: when saving new/edited work, offer to share it.
      if (resource.visibility === "private") setShareDialogOpen(true);
      router.refresh();
    });
  };

  const saveTags = (names: string[]) => {
    setTagNames(names);
    startTransition(async () => {
      const result = await updateResourceTagsAction(resource.id, names);
      if (!result.ok) toast.error(result.error ?? "Tags couldn't be updated.");
      else router.refresh();
    });
  };

  const setSharing = (share: boolean) => {
    startTransition(async () => {
      const result = await setResourceSharingAction(resource.id, share);
      if (!result.ok) {
        toast.error(result.error ?? "Sharing preference couldn't be saved.");
        return;
      }
      toast.success(
        share ? "Shared with your centre. Thank you for contributing." : "Kept private.",
      );
      setShareDialogOpen(false);
      router.refresh();
    });
  };

  const restore = (versionNumber: number) => {
    startTransition(async () => {
      const result = await restoreResourceVersionAction(resource.id, versionNumber);
      if (!result.ok) {
        toast.error(result.error ?? "The version couldn't be restored.");
        return;
      }
      toast.success(`Version ${versionNumber} restored as a new version.`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link
          href="/centre"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Centre Intelligence
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            {isEditing ? (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="max-w-lg text-lg font-semibold"
              />
            ) : (
              <h1 className="text-2xl font-semibold tracking-tight">{resource.title}</h1>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="quiet">{RESOURCE_TYPE_LABELS[resource.type]}</Badge>
              <span>v{resource.currentVersion}</span>
              {resource.createdByName ? <span>· {resource.createdByName}</span> : null}
              {resource.visibility === "private" ? (
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Private
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> Shared with centre
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isOwner && resource.visibility === "private" ? (
              <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)}>
                <Users /> Share to centre
              </Button>
            ) : null}
            {isEditing ? (
              <>
                <Button size="sm" onClick={save} disabled={isPending}>
                  {isPending ? "Saving…" : "Save new version"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setTitle(resource.title);
                    setText(latestText);
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil /> Edit
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {tagNames.map((name) => (
            <Badge key={name} variant="secondary" className="gap-1 font-normal">
              {name}
              {isEditing ? (
                <button
                  aria-label={`Remove tag ${name}`}
                  onClick={() => saveTags(tagNames.filter((t) => t !== name))}
                  className="opacity-60 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </Badge>
          ))}
          {isEditing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const value = newTag.trim();
                if (value && !tagNames.includes(value)) saveTags([...tagNames, value]);
                setNewTag("");
              }}
            >
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag…"
                className="h-6 w-24 rounded-full border border-dashed border-input bg-transparent px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </form>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="versions">
            Versions <span className="ml-1.5 text-muted-foreground">{versions.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          {isEditing ? (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={22}
              className="rounded-2xl text-[15px] leading-relaxed"
            />
          ) : latestText ? (
            <article className="whitespace-pre-wrap rounded-2xl border bg-card p-8 text-[15px] leading-relaxed shadow-calm">
              {latestText}
            </article>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/50 px-8 py-14 text-center">
              <FileArchive className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                The original file{" "}
                {resource.originalFilename ? `“${resource.originalFilename}” ` : ""}is stored
                safely. Full text extraction for this format is on the roadmap — the resource
                is searchable by title and tags, and you can add text yourself with Edit.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="versions">
          <ul className="space-y-2">
            {versions.map((version) => (
              <li
                key={version.id}
                className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3"
              >
                <History className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    Version {version.versionNumber}
                    {version.versionNumber === resource.currentVersion ? (
                      <span className="ml-2 text-xs font-normal text-success">Current</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {version.createdByAtlas ? "Atlas" : (version.createdByName ?? "Teacher")} ·{" "}
                    {formatDateTime(version.createdAt)}
                    {version.changeNote ? ` · ${version.changeNote}` : ""}
                  </p>
                </div>
                {version.versionNumber !== resource.currentVersion ? (
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
        </TabsContent>
      </Tabs>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Would you like other teachers in your centre to benefit from this?
            </DialogTitle>
            <DialogDescription>
              Sharing adds “{title}” to Centre Intelligence for everyone at your centre.
              You can change this any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-start">
            <Button onClick={() => setSharing(true)} disabled={isPending}>
              Save to Centre Intelligence
            </Button>
            <Button variant="outline" onClick={() => setSharing(false)} disabled={isPending}>
              Keep private
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
