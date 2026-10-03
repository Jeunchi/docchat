"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const field =
  "w-full rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";

export function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const signup = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = signup
      ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
      : await authClient.signIn.email({ email: email.trim(), password });
    setLoading(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-white p-4 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">DocChat</h1>
          <p className="text-sm text-zinc-500">
            Ask questions about your PDFs and get answers that cite their sources.
          </p>
        </div>

        {signup && (
          <div className="space-y-1">
            <label htmlFor="name" className="text-sm">Name</label>
            <input
              id="name"
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm">Email</label>
          <input
            id="email"
            type="email"
            className={field}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm">Password</label>
          <input
            id="password"
            type="password"
            className={field}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={signup ? 8 : undefined}
            required
          />
          {signup && <p className="text-xs text-zinc-500">At least 8 characters.</p>}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-50"
        >
          {loading ? "Please wait…" : signup ? "Create account" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(signup ? "signin" : "signup");
            setError("");
          }}
          className="w-full text-sm text-blue-600 underline dark:text-blue-400"
        >
          {signup ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>

        <p className="text-xs text-zinc-500">
          This is a demo. Please don&apos;t upload confidential documents.
        </p>
      </form>
    </div>
  );
}