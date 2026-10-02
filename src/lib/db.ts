import postgres from "postgres";

// Reuse one connection across hot reloads in dev.
const g = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

export const sql = g.sql ?? postgres(process.env.DATABASE_URL!);

if (process.env.NODE_ENV !== "production") g.sql = sql;