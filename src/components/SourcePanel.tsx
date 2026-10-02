"use client";

import { useEffect, useRef } from "react";
import type { SourceInfo } from "@/lib/types";

export function SourcePanel({
  source,
  onClose,
}: {
  source: SourceInfo;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, [source]);

  return (
    <aside
      aria-label="Source passage"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="absolute inset-0 z-10 overflow-y-auto bg-white p-4 dark:bg-zinc-950 sm:static sm:inset-auto sm:w-96 sm:shrink-0 sm:border-l sm:border-zinc-200 sm:dark:border-zinc-800"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{source.filename}</h2>
          <p className="text-sm text-zinc-500">
            Page {source.page} · relevance {source.score.toFixed(2)}
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="rounded border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Close
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{source.content}</p>
    </aside>
  );
}