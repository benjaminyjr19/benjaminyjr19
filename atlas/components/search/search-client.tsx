"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FileQuestion, Search as SearchIcon } from "lucide-react";

import { RESOURCE_TYPE_ICONS } from "@/components/cards/resource-card";
import { AtlasWorking } from "@/components/layout/atlas-working";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { SearchResult } from "@/lib/types";
import { RESOURCE_TYPE_LABELS } from "@/lib/types";

const SUGGESTIONS = ["sensory play", "observation", "rainy day", "policy", "seeds"];

export function SearchClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();

    if (!trimmed) {
      setResults(null);
      setIsSearching(false);
      setError(null);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestRef.current;
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (requestId !== requestRef.current) return;
        if (!response.ok) throw new Error("search failed");
        const data = (await response.json()) as { results: SearchResult[] };
        setResults(data.results);
        setError(null);
      } catch {
        if (requestId !== requestRef.current) return;
        setError("Search is having a moment. Please try again.");
      } finally {
        if (requestId === requestRef.current) setIsSearching(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your centre's resources, templates, activities, policies…"
          autoFocus
          className="h-13 w-full rounded-2xl border border-input bg-card py-3.5 pl-11 pr-4 text-[15px] shadow-calm transition-colors placeholder:text-muted-foreground/60 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

      {!query.trim() ? (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
          <span className="text-xs text-muted-foreground/70">Try</span>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setQuery(suggestion)}
              className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : isSearching && results === null ? (
        <AtlasWorking message="Atlas is searching Centre Intelligence…" />
      ) : error ? (
        <EmptyState icon={FileQuestion} title="Search hiccup" description={error} />
      ) : results && results.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="Nothing found"
          description={`No resources match “${query.trim()}”. Try a different word, or upload it to Centre Intelligence and Atlas will file it.`}
        />
      ) : results ? (
        <div className={isSearching ? "space-y-3 opacity-60 transition-opacity" : "space-y-3"}>
          {results.map((result) => (
            <SearchResultCard key={result.resourceId} result={result} query={query} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SearchResultCard({ result, query }: { result: SearchResult; query: string }) {
  const Icon = RESOURCE_TYPE_ICONS[result.type];
  return (
    <Link href={`/centre/${result.resourceId}`} className="group block focus-visible:outline-none">
      <Card className="flex items-start gap-4 p-5 transition-all group-hover:shadow-calm-lg group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft">
          <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium leading-snug">{result.title}</p>
            <Badge variant="quiet" className="text-[10px]">
              {RESOURCE_TYPE_LABELS[result.type]}
            </Badge>
          </div>
          {result.snippet ? (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              <Highlighted text={result.snippet} query={query} />
            </p>
          ) : null}
          {result.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {result.tags.slice(0, 4).map((tag) => (
                <Badge key={tag.id} variant="secondary" className="text-[10px] font-normal">
                  {tag.name}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  if (terms.length === 0) return <>{text}</>;

  const pattern = new RegExp(
    `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        pattern.test(part) ? (
          <mark key={i} className="rounded-sm bg-primary-soft px-0.5 text-accent-foreground">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
