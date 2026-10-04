"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { Message } from "@/components/Message";
import { SourcePanel } from "@/components/SourcePanel";
import { UploadButton } from "@/components/UploadButton";
import { authClient } from "@/lib/auth-client";
import type { ChatMessage, SourceInfo } from "@/lib/types";

type Doc = { id: string; filename: string; status: string };

const transport = new DefaultChatTransport({ api: "/api/chat" });

function friendlyError(err: Error) {
  try {
    const parsed = JSON.parse(err.message);
    if (typeof parsed?.error === "string") return parsed.error;
  } catch {
    // not JSON, fall through
  }
  return "Something went wrong. Please try again.";
}

export function ChatApp({ user }: { user: { name: string; email: string } }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [input, setInput] = useState("");
  const [active, setActive] = useState<SourceInfo | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, error } = useChat<ChatMessage>({ transport });
  const busy = status === "submitted" || status === "streaming";

  const loadDocs = useCallback(async () => {
    const res = await fetch("/api/documents");
    const all: Doc[] = await res.json();
    setDocs(all.filter((d) => d.status === "ready"));
  }, []);

  useEffect(() => {
    loadDocs().catch(() => {});
  }, [loadDocs]);

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

  async function deleteDoc() {
    setDeleteError("");
    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Delete failed.");
      }
      setDocumentId("");
      setActive(null);
      await loadDocs();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="relative flex h-dvh bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h1 className="text-lg font-semibold">DocChat</h1>
          <UploadButton
            onUploaded={async (id) => {
              await loadDocs();
              setDocumentId(id);
              setConfirmingDelete(false);
            }}
          />

          <div className="ml-auto flex items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-zinc-500">Document</span>
              <select
                value={documentId}
                onChange={(e) => {
                  setDocumentId(e.target.value);
                  setConfirmingDelete(false);
                  setDeleteError("");
                }}
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

            {documentId &&
              (confirmingDelete ? (
                <span
                  className="flex items-center gap-2"
                  onKeyDown={(e) => e.key === "Escape" && setConfirmingDelete(false)}
                >
                  <button
                    type="button"
                    autoFocus
                    onClick={deleteDoc}
                    className="rounded bg-red-600 px-3 py-1 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
                  >
                    Confirm delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-700"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  aria-label="Delete selected document"
                  className="rounded border border-zinc-300 px-3 py-1 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Delete
                </button>
              ))}

            <span className="hidden max-w-32 truncate text-zinc-500 sm:inline" title={user.email}>
              {user.name}
            </span>
            <button
              type="button"
              onClick={() => authClient.signOut()}
              className="rounded border border-zinc-300 px-3 py-1 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </div>

          {deleteError && (
            <p role="alert" className="w-full text-sm text-red-600">
              {deleteError}
            </p>
          )}
        </header>

        <div
          role="log"
          aria-label="Conversation"
          aria-busy={busy}
          className="flex-1 space-y-4 overflow-y-auto px-4 py-6"
        >
          {messages.length === 0 && (
            <p className="text-center text-zinc-500">
              {docs.length === 0
                ? "Upload a PDF to get started."
                : "Pick a document and ask a question. Answers cite their sources."}
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
                {friendlyError(error)}
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