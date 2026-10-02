"use client";

import ReactMarkdown from "react-markdown";
import { normalizeCitations } from "@/lib/rag";
import type { ChatMessage, SourceInfo } from "@/lib/types";

export function Message({
  message,
  onCite,
}: {
  message: ChatMessage;
  onCite: (source: SourceInfo) => void;
}) {
  let text = "";
  let sources: SourceInfo[] = [];
  for (const p of message.parts) {
    if (p.type === "text") text += p.text;
    else if (p.type === "data-sources") sources = p.data;
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-blue-600 px-4 py-2 text-white">
          {text}
        </p>
      </div>
    );
  }

  const clean = normalizeCitations(text);
  const cited = [...new Set([...clean.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))]
    .filter((n) => n >= 1 && n <= sources.length)
    .sort((a, b) => a - b);

  // Turn [1] into a markdown link we can render as a chip.
  const markdown = clean.replace(/\[(\d+)\]/g, (match, n) =>
    Number(n) >= 1 && Number(n) <= sources.length ? `[${n}](#cite-${n})` : match
  );

  const chip =
    "mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-blue-100 px-1 align-baseline text-xs font-medium text-blue-800 hover:bg-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:bg-blue-900 dark:text-blue-100 dark:hover:bg-blue-800";

  return (
    <div className="max-w-[85%] space-y-2">
      <div className="space-y-2 leading-relaxed">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p>{children}</p>,
            ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
            a: ({ href, children }) => {
              const m = href?.match(/^#cite-(\d+)$/);
              if (m) {
                const n = Number(m[1]);
                return (
                  <button
                    type="button"
                    className={chip}
                    aria-label={`Open source ${n}`}
                    onClick={() => onCite(sources[n - 1])}
                  >
                    {n}
                  </button>
                );
              }
              return (
                <a href={href} target="_blank" rel="noreferrer" className="underline">
                  {children}
                </a>
              );
            },
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>

      {cited.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>Sources:</span>
          {cited.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onCite(sources[n - 1])}
              className="rounded border border-zinc-300 px-2 py-0.5 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {n} · {sources[n - 1].filename} p.{sources[n - 1].page}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}