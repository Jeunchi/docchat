import { sql } from "../src/lib/db";

// Dev scripts act as one user: SCRIPT_USER_ID, or the first account created.
export async function scriptUserId() {
  if (process.env.SCRIPT_USER_ID) return process.env.SCRIPT_USER_ID;
  const [u] = await sql`select id from "user" order by "createdAt" asc limit 1`;
  if (!u) throw new Error("No users yet. Sign up in the app first.");
  return u.id as string;
}