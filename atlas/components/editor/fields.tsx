"use client";

import { useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Document-style editing primitives: fields look like typeset text until you
 * hover or focus them — the plan reads like a document, not a form.
 */

export function InlineInput({
  value,
  onChange,
  className,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-lg bg-transparent px-1.5 py-0.5 -mx-1.5 transition-colors placeholder:text-muted-foreground/50 hover:bg-muted/70 focus:bg-muted/70 focus:outline-none focus:ring-1 focus:ring-ring/40",
        className,
      )}
    />
  );
}

export function InlineTextarea({
  value,
  onChange,
  className,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow to fit content.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className={cn(
        "w-full resize-none overflow-hidden rounded-lg bg-transparent px-1.5 py-0.5 -mx-1.5 leading-relaxed transition-colors placeholder:text-muted-foreground/50 hover:bg-muted/70 focus:bg-muted/70 focus:outline-none focus:ring-1 focus:ring-ring/40",
        className,
      )}
    />
  );
}

export function StringListEditor({
  items,
  onChange,
  addLabel,
  itemClassName,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  addLabel: string;
  itemClassName?: string;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((item, index) => (
        <div key={index} className="group flex items-start gap-2">
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
          <InlineTextarea
            value={item}
            ariaLabel={`Item ${index + 1}`}
            onChange={(value) =>
              onChange(items.map((existing, i) => (i === index ? value : existing)))
            }
            className={cn("text-[15px]", itemClassName)}
          />
          <button
            aria-label="Remove item"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            className="mt-1.5 rounded-full p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ""])}
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> {addLabel}
      </button>
    </div>
  );
}
