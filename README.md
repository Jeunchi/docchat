# DocChat

**Chat with your PDFs and get answers that cite their sources.** Upload a document, ask a question in plain language, and get a streamed answer with clickable citations that open the exact passage and page it came from. If the answer isn't in your documents, it says so instead of guessing.

**Live demo:** https://docchat-mocha-five.vercel.app

> This is a portfolio project that runs entirely on free tiers. Create an account to try it, and please don't upload confidential documents. Usage limits apply, and the free language-model tier can occasionally rate-limit requests.


![DocChat answering a question with inline citations](docs/screenshot-chat.png)

![The source panel showing the cited passage and its pages](docs/screenshot-sources.png)


## Features

- **Grounded answers with citations.** Every claim ends in a numbered chip like `[1]`. Click it to open the source passage, its filename, and its page range.
- **Honest refusals.** Questions the documents can't answer get "I couldn't find that in the uploaded documents."
- **Follow-up questions that work.** A short question like "which of those is about email?" is rewritten into a standalone question before searching.
- **Hybrid search.** Meaning-based vector search and keyword search are combined, so both paraphrases and exact terms (a figure, an ID, a name) are found.
- **Private by design.** Email and password accounts. Each user sees only their own documents, and every API route requires sign-in.
- **Streaming UI with real states.** Token-by-token streaming, a Stop button (or Esc), upload progress, clear error messages, and dark mode.
- **Keyboard accessible.** Enter to send, Shift+Enter for a new line, visible focus rings, labelled controls, and live regions for streamed text.
- **Abuse protection.** Per-user and global usage limits stored in Postgres, plus caps on file size, page count, and documents per user.

## How it works

**Adding a document**

```mermaid
flowchart LR
  A["PDF upload"] --> B["Validate: signed in, PDF signature, size and usage limits"]
  B --> C["Extract text per page with unpdf"]
  C --> D["Chunk: about 180 words, 30 overlap, page ranges kept"]
  D --> E["Embed locally with MiniLM, 384 dimensions"]
  E --> F[("Postgres + pgvector")]
```

**Asking a question**

```mermaid
flowchart LR
  Q["Question"] --> R["Rewrite follow-ups as standalone questions"]
  R --> V["Vector search over your documents"]
  R --> K["Keyword search over your documents"]
  V --> M["Merge with reciprocal rank fusion, keep top 8"]
  K --> M
  M --> G["Streamed answer grounded in the sources"]
  G --> U["Citations open the source passage"]
```

The model is instructed to answer only from the numbered sources, cite them, say when the answer isn't there, and treat document text as data rather than instructions.

## Evaluation

I measured retrieval and answer quality on a small question set instead of judging by eye. The questions, their expected evidence phrases, and the scoring script are in [`eval/`](eval) and [`scripts/eval.ts`](scripts/eval.ts).

| Measure | Result |
|---|---|
| Questions | 37 across 5 documents (33 answerable, 4 deliberately unanswerable) |
| Right passage in top 8 | 33/33 (100%) |
| Right passage in top 3 | 29/33 (87.9%) |
| Mean reciprocal rank | 0.771 |
| Answer accuracy | 32/33 (97.0%) |
| Correct refusals | 4/4 |

**Hybrid search vs. vector-only**, on the 26 questions that appear in both versions of the test set:

| | Top 8 | Top 3 | Mean reciprocal rank |
|---|---|---|---|
| Vector only | 25/26 (96.2%) | 22/26 (84.6%) | 0.685 |
| Hybrid (vector + keyword) | 26/26 (100%) | 24/26 (92.3%) | 0.772 |

Eight questions ranked higher with hybrid search and two ranked lower, so it is an improvement but not a pure win. The vector-only numbers come from an earlier run of the first 30 questions, and its raw output isn't saved in this repo.

**How to read these numbers honestly**

- The set is small, so one question is about 3 percentage points.
- The questions were written from the documents' text, which favors phrasing close to the source. I added paraphrased questions to reduce that, but it is still easier than real use.
- "Top 8" is easy for short documents (one document here has only 5 chunks), so top 3 and mean reciprocal rank are the more meaningful figures.
- Language-model answers vary between runs, so answer accuracy can move by a question or two.
- Early on, an overly strict answer matcher marked two correct answers as wrong. I corrected its patterns after reading the answers. The one remaining failure is a real incomplete answer (it said "8 good beans and 7 bad beans" and dropped "out of 10" for each), so I left it as a failure.
- The weakest area is long documents with paraphrased questions: three of the four questions that missed the top 3 came from one long paper.

To reproduce, upload documents whose filenames match the keys in [`eval/questions.json`](eval/questions.json) (or replace the file with questions about your own documents), then run:

```bash
npx tsx scripts/eval.ts --retrieval-only   # retrieval only, no language-model calls
npx tsx scripts/eval.ts                    # full run, about 30 to 40 Groq requests
```

## Tech stack

Everything below runs on a free tier.

| Layer | Choice |
|---|---|
| App | Next.js (App Router), React, TypeScript, Tailwind CSS |
| Streaming and chat state | Vercel AI SDK (`ai`, `@ai-sdk/react`) |
| Language models | Groq free tier: `openai/gpt-oss-120b` for answers, `openai/gpt-oss-20b` for rewriting follow-ups |
| Embeddings | `all-MiniLM-L6-v2` (384 dimensions) running in-process with Transformers.js, so there is no embedding API or quota |
| Database | Postgres with pgvector: Neon in production, a Docker container locally |
| Auth | Better Auth (email and password), with users and sessions stored in the same Postgres |
| PDF text | `unpdf` |
| Rendering | `react-markdown` |
| Hosting | Vercel Hobby |

## Design decisions

- **Local embeddings.** Free, no rate limits, and no data sent to a third party for indexing. The tradeoff is a small model and a slow first request while it loads.
- **Chunk size.** The embedding model reads about 256 tokens, so chunks are about 180 words with a 30-word overlap. Chunks run across page breaks so lists and their headings stay together, and each chunk stores its page range for accurate citations.
- **Hybrid retrieval with reciprocal rank fusion.** Each search returns its top 30, and the two ranked lists are merged by `1 / (60 + rank)`. It needs no tuning weights and is easy to explain.
- **No relevance score gate.** I first skipped the language model when the top similarity score was low. The evaluation showed that rejected valid short questions, so the model now makes the "not found" call itself, and it refuses correctly.
- **Citation normalization.** The model sometimes writes citations like `【2†L1-L9】`. A small function converts all variants to `[2]` before rendering.
- **Limits in Postgres, not memory.** Serverless instances come and go, so in-memory counters would reset constantly.
- **Configurable model names.** Hosted model names get retired, so they are environment variables.

## Security and privacy

- Every API route requires a signed-in user. The chat route checks this before any search or model call, so anonymous traffic can't spend the model quota.
- Every database query is scoped to the signed-in user, and deleting someone else's document returns "not found". I verified this with two accounts, including a cross-account delete attempt.
- Uploads are checked for the `%PDF` signature, size, page count, and per-user quota. Failed uploads are cleaned up.
- Passwords are stored hashed.
- Document text is passed to the model as data, with an instruction not to follow commands found inside it. That reduces prompt-injection risk but doesn't eliminate it.
- Email addresses are not verified, so anyone can create an account with any address. Per-user limits can be bypassed by making accounts, which is why there is also a global daily cap.

## Getting started

**Prerequisites:** Node.js 20 or newer, Docker, and a free [Groq](https://console.groq.com) API key.

```bash
git clone https://github.com/Jeunchi/docchat.git
cd docchat
npm install
cp .env.example .env.local        # on Windows: copy .env.example .env.local
```

Fill in `.env.local`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5433/postgres` |
| `GROQ_API_KEY` | your Groq key |
| `BETTER_AUTH_SECRET` | a random string, for example `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `BETTER_AUTH_URL` | `http://localhost:3000` (match the port you open in the browser) |

Start Postgres and create the tables, in this order:

```bash
docker run -d --name docchat-db -e POSTGRES_PASSWORD=postgres -p 5433:5432 pgvector/pgvector:pg16

docker exec -i docchat-db psql -U postgres < db/schema.sql
DATABASE_URL=postgres://postgres:postgres@localhost:5433/postgres npx auth@latest migrate
docker exec -i docchat-db psql -U postgres < db/002_user_ownership.sql
docker exec -i docchat-db psql -U postgres < db/003_usage_events.sql

npm run dev
```

The auth migration creates the `user`, `session`, `account`, and `verification` tables, so it has to run before `002_user_ownership.sql`.

On Windows PowerShell, `<` redirection isn't supported. Use `Get-Content db\schema.sql | docker exec -i docchat-db psql -U postgres` instead, and set the variable with `$env:DATABASE_URL="..."`.

The first request that embeds text downloads the embedding model, so it is slower than later ones. Optional usage-limit settings are listed in `.env.example`.

### Command-line tools

These act as one user: the one in `SCRIPT_USER_ID`, or by default the first account created.

```bash
npx tsx scripts/ingest.ts path/to/file.pdf               # add a document
npx tsx scripts/search.ts "your question"                # show retrieved chunks and scores
npx tsx scripts/ask.ts [--doc=<id>] [--debug] "question" # full question and answer in the terminal
npx tsx scripts/eval.ts [--retrieval-only]               # run the evaluation
```

## Deployment notes (Vercel + Neon)

Set `DATABASE_URL` (Neon's pooled connection string), `GROQ_API_KEY`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` (the production address) in Vercel, and run the same four SQL steps against Neon. Things that broke on the way, and what fixed them:

| Problem | Fix |
|---|---|
| Vercel limits request bodies to 4.5 MB | Upload limit is 4 MB |
| The embedding library's native runtime was missing from the production bundle | Production builds use `next build --webpack`, and the library is loaded lazily so routes that don't embed text never touch it |
| The model cache directory is read-only on serverless | Cache in `/tmp` when running on Vercel |
| Neon's connection pooler doesn't suit prepared statements | `prepare: false` in the Postgres client |
| Better Auth rejected sign-ins from the production address ("invalid origin") | Set `BETTER_AUTH_URL` to the production address and trust Vercel's URLs in `trustedOrigins` |

In my production test, uploading a small PDF took about 15 seconds, since embedding runs in the serverless function.

## Project structure

```
db/                    SQL for the tables, user ownership, and usage tracking
eval/                  Evaluation questions and the last results
scripts/               Command-line tools: ingest, search, ask, eval
src/app/               Pages and API routes (auth, chat, documents)
src/components/        AuthForm, ChatApp, Message, SourcePanel, UploadButton
src/lib/
  auth.ts              Better Auth configuration
  chunk.ts             Page-aware text chunking
  condense.ts          Follow-up question rewriting
  embed.ts             Local embeddings
  ingest.ts            PDF to chunks to database
  limits.ts            Usage limits
  rag.ts               Prompt and citation helpers
  retrieve.ts          Hybrid search scoped to one user
```

## Limitations and next steps

- PDFs with selectable text only. Scanned PDFs need OCR, which isn't built.
- Limits of 4 MB, 100 pages, and 10 documents per user.
- Each answer is based on the retrieved passages and a rewritten question, not on the full conversation history.
- The embedding model is small. Because the evaluation harness exists, trying a larger model or adding a reranking step can be measured instead of guessed.
- The evaluation set is small and written by the project author.
- There are no automated unit or integration tests beyond the type check and the evaluation harness.
- Free-tier cold starts and rate limits make the live demo slower and less predictable than a paid setup.

Ideas: DOCX and Markdown support, email verification, upload progress from the server, and running the retrieval-only evaluation in CI.

## Author

<<<<<<< HEAD
Built by Junjie Mempin. [GitHub](https://github.com/Jeunchi)
=======
Built by Junjie Mempin. [GitHub](https://github.com/Jeunchi)
>>>>>>> cbfd3c7a349253e3de8afd4bccd2f18ccc5b1d0f
