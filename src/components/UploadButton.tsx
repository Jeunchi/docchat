"use client";

import { useRef, useState } from "react";

type State =
  | { kind: "idle" }
  | { kind: "uploading"; name: string }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

const MAX_BYTES = 10 * 1024 * 1024;

export function UploadButton({
  onUploaded,
}: {
  onUploaded: (documentId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const uploading = state.kind === "uploading";

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      setState({ kind: "error", message: "Only PDF files are supported." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setState({ kind: "error", message: "That file is larger than 10 MB." });
      return;
    }

    setState({ kind: "uploading", name: file.name });
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");

      setState({
        kind: "done",
        message: `${file.name} is ready (${data.chunks} passages indexed).`,
      });
      onUploaded(data.documentId);
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Upload failed.",
      });
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="shrink-0 rounded border border-zinc-300 px-3 py-1 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {uploading ? "Indexing…" : "Upload PDF"}
      </button>

      <span role="status" aria-live="polite" className="truncate text-zinc-500">
        {state.kind === "uploading" && `Indexing ${state.name}… this can take a minute.`}
        {state.kind === "done" && state.message}
      </span>
      {state.kind === "error" && (
        <span role="alert" className="truncate text-red-600">
          {state.message}
        </span>
      )}
    </div>
  );
}