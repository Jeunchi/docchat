import { sql } from "./db";

type Kind = "chat" | "upload";
type Rule = { windowSeconds: number; max: number; message: string };

// Every number can be overridden with an environment variable.
function num(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const MAX_DOCS_PER_USER = num("MAX_DOCS_PER_USER", 10);
export const MAX_PDF_PAGES = num("MAX_PDF_PAGES", 100);

const GLOBAL_CHAT_PER_DAY = num("GLOBAL_CHAT_PER_DAY", 300);

const RULES: Record<Kind, Rule[]> = {
  chat: [
    {
      windowSeconds: 60,
      max: num("CHAT_PER_MINUTE", 10),
      message: "You're asking too fast. Please wait a minute and try again.",
    },
    {
      windowSeconds: 86400,
      max: num("CHAT_PER_DAY", 60),
      message: "You've reached today's question limit. Please try again tomorrow.",
    },
  ],
  upload: [
    {
      windowSeconds: 3600,
      max: num("UPLOAD_PER_HOUR", 5),
      message: "Upload limit reached. Please try again in an hour.",
    },
  ],
};

export type LimitResult = { ok: true } | { ok: false; message: string };

// Checks the user's limits; if they pass, records the event.
export async function checkAndRecord(userId: string, kind: Kind): Promise<LimitResult> {
  for (const rule of RULES[kind]) {
    const [row] = await sql`
      select count(*)::int as n from usage_events
      where user_id = ${userId} and kind = ${kind}
        and created_at > now() - (${rule.windowSeconds}::int * interval '1 second')
    `;
    if (row.n >= rule.max) return { ok: false, message: rule.message };
  }

  if (kind === "chat") {
    const [g] = await sql`
      select count(*)::int as n from usage_events
      where kind = 'chat' and created_at > now() - interval '1 day'
    `;
    if (g.n >= GLOBAL_CHAT_PER_DAY) {
      return {
        ok: false,
        message: "The demo has reached its daily capacity. Please try again tomorrow.",
      };
    }
  }

  await sql`insert into usage_events (user_id, kind) values (${userId}, ${kind})`;

  // Occasionally clear old rows so the table stays small.
  if (Math.random() < 0.02) {
    await sql`delete from usage_events where created_at < now() - interval '2 days'`;
  }

  return { ok: true };
}