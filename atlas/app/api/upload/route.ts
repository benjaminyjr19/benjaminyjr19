import { NextResponse } from "next/server";

import { ingestUpload } from "@/core/resources/service";
import { getWorkspace } from "@/core/workspace/service";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB per file for MVP

const ACCEPTED_PREFIXES = ["text/", "image/"];
const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/json",
]);

function isAccepted(mimeType: string, filename: string): boolean {
  if (ACCEPTED_PREFIXES.some((p) => mimeType.startsWith(p))) return true;
  if (ACCEPTED_TYPES.has(mimeType)) return true;
  // Some browsers send empty/generic types for .md and .txt.
  return /\.(md|markdown|txt|csv)$/i.test(filename);
}

/**
 * Upload endpoint. Each file runs the full pipeline:
 * store → parse → version → chunk → classify → tag → duplicate-check → feed.
 * Responds per-file so the client can walk the teacher through sharing and
 * duplicate decisions.
 */
export async function POST(request: Request) {
  const workspace = await getWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files received." }, { status: 400 });
  }

  const results = [];
  for (const file of files.slice(0, 10)) {
    if (file.size > MAX_FILE_BYTES) {
      results.push({
        filename: file.name,
        ok: false as const,
        error: "This file is larger than 15 MB.",
      });
      continue;
    }
    if (!isAccepted(file.type, file.name)) {
      results.push({
        filename: file.name,
        ok: false as const,
        error: "Atlas accepts PDF, Word, PowerPoint, images and text files.",
      });
      continue;
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await ingestUpload(workspace, {
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        buffer,
      });
      results.push({
        filename: file.name,
        ok: true as const,
        resource: {
          id: result.resource.id,
          title: result.resource.title,
          type: result.resource.type,
          tags: result.resource.tags.map((t) => t.name),
        },
        duplicate: result.duplicate
          ? {
              resourceId: result.duplicate.resourceId,
              title: result.duplicate.title,
              similarity: result.duplicate.similarity,
            }
          : null,
        parserWarning: result.parserWarning,
      });
    } catch (error) {
      console.error("[atlas:upload]", error);
      results.push({
        filename: file.name,
        ok: false as const,
        error: "Atlas couldn't process this file. Please try again.",
      });
    }
  }

  return NextResponse.json({ results });
}
