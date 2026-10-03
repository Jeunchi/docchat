"use client";

import { AuthForm } from "@/components/AuthForm";
import { ChatApp } from "@/components/ChatApp";
import { authClient } from "@/lib/auth-client";

export default function Home() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div
        role="status"
        className="flex h-dvh items-center justify-center bg-white text-zinc-500 dark:bg-zinc-950"
      >
        Loading…
      </div>
    );
  }

  if (!session) return <AuthForm />;

  // key: switching users remounts the chat so no messages carry over
  return <ChatApp key={session.user.id} user={session.user} />;
}