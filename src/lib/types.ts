import type { UIMessage } from "ai";

export type SourceInfo = {
  id: string;
  filename: string;
  page: number;
  score: number;
  content: string;
  pageEnd: number;
};

// Assistant messages carry a custom "sources" data part next to the text.
export type ChatMessage = UIMessage<unknown, { sources: SourceInfo[] }>;