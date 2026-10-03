import { headers } from "next/headers";
import { auth } from "./auth";

// Returns the signed-in user's id, or null if nobody is signed in.
export async function getUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}