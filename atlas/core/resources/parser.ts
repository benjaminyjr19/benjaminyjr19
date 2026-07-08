import { normalizeWhitespace } from "@/lib/utils/text";

export interface ParsedDocument {
  /** Extracted plain text. Empty string when this format isn't parseable yet. */
  text: string;
  parser: "text" | "placeholder";
  /** Human-readable note when extraction was skipped. */
  warning?: string;
}

const TEXT_MIME_PREFIXES = ["text/"];
const TEXT_MIME_EXACT = new Set([
  "application/json",
  "application/xml",
  "application/x-yaml",
]);
const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "json", "text"]);

const RICH_FORMATS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document",
  "application/msword": "Word document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "application/vnd.ms-powerpoint": "PowerPoint",
};

function extension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * parseDocument(file) -> extractedText
 *
 * Parser abstraction for uploaded files. Plain-text formats are extracted
 * natively. Rich formats (PDF / DOCX / PPTX) and images store the original
 * file and return a placeholder — the resource stays fully usable (titled,
 * classified by filename, tagged, versioned) and becomes searchable by title.
 *
 * TODO(post-MVP): swap the placeholder branch for a real extraction service —
 * LlamaParse, Unstructured, or Azure Document Intelligence. The interface is
 * already shaped for it: implement `parse(buffer, mimeType) -> text` behind
 * this function and nothing upstream changes. OCR for images lands the same way.
 */
export async function parseDocument(file: {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}): Promise<ParsedDocument> {
  const { buffer, mimeType, filename } = file;

  const isTextLike =
    TEXT_MIME_PREFIXES.some((p) => mimeType.startsWith(p)) ||
    TEXT_MIME_EXACT.has(mimeType) ||
    TEXT_EXTENSIONS.has(extension(filename));

  if (isTextLike) {
    const text = normalizeWhitespace(buffer.toString("utf-8"));
    return { text, parser: "text" };
  }

  const formatLabel =
    RICH_FORMATS[mimeType] ??
    (mimeType.startsWith("image/") ? "image" : "file");

  return {
    text: "",
    parser: "placeholder",
    warning: `Atlas stored the original ${formatLabel} safely. Full text extraction for this format is on the roadmap — the resource is searchable by its title and tags for now.`,
  };
}
