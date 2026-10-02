"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { Message } from "@/components/Message";
import { SourcePanel } from "@/components/SourcePanel";
import type { ChatMessage, SourceInfo } from "@/lib/types";

type Doc = { id: string; filename: string; status: string };

const transport = new DefaultChatTransport({ api: "/api/chat" });

export default function Home() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [input, setInput] = useState("");
  const [active, setActive] = useState<SourceInfo | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, error } = useChat<ChatMessage>({ transport });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((d: Doc[]) => setDocs(d.filter((x) => x.status === "ready")))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text }, { body: { documentId: documentId || undefined } });
    setInput("");
  }

  return (
    <div className="relative flex h-dvh bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h1 className="text-lg font-semibold">DocChat</h1>
          <label className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Document</span>
            <select
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              className="max-w-48 rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
            >
              <option value="">All documents</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id} className="text-black">
                  {d.filename}
                </option>
              ))}
            </select>
          </label>
        </header>

        <div
          role="log"
          aria-label="Conversation"
          aria-busy={busy}
          className="flex-1 space-y-4 overflow-y-auto px-4 py-6"
        >
          {messages.length === 0 && (
            <p className="text-center text-zinc-500">
              Pick a document and ask a question. Answers cite their sources.
            </p>
          )}
          {messages.map((m) => (
            <Message key={m.id} message={m} onCite={setActive} />
          ))}
          {status === "submitted" && (
            <p className="text-sm text-zinc-500">Searching your documents…</p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600">
              Something went wrong. Please try again.
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={submit}
          className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape" && busy) stop();
            }}
            rows={1}
            aria-label="Ask a question"
            placeholder="Ask a question (Enter to send, Shift+Enter for a new line)"
            className="min-h-10 flex-1 resize-none rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              className="rounded border border-zinc-300 px-4 dark:border-zinc-700"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded bg-blue-600 px-4 text-white disabled:opacity-50"
            >
              Send
            </button>
          )}
        </form>
      </main>

      {active && (
        <SourcePanel
          source={active}
          onClose={() => {
            setActive(null);
            inputRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}