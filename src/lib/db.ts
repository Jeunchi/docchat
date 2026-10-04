import postgres from "postgres";

// Neon's default connection string includes channel_binding=require. postgres.js
// would send that to the server as an unknown setting, so remove it.
// (Harmless if the parameter isn't there.)
function stripChannelBinding(raw: string) {
  return raw
    .replace(/([?&])channel_binding=[^&]*(&?)/, (_m, sep: string, amp: string) => (amp ? sep : ""))
    .replace(/[?&]$/, "");
}

// Reuse one connection across hot reloads in dev.
const g = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

export const sql =
  g.sql ??
  postgres(stripChannelBinding(process.env.DATABASE_URL ?? ""), {
    prepare: false,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") g.sql = sql;