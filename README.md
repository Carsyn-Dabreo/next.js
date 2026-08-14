# Research Command Center

An AI-powered research workspace that turns complex questions into structured research using web retrieval, source-grounded generation, and an interactive dashboard.

## What it does

1. Accepts a natural-language research question.
2. Retrieves relevant evidence from Wikipedia and arXiv without requiring a paid search API.
3. Builds a compact evidence context from the retrieved sources.
4. Sends the evidence to an LLM through OpenRouter's free-model router.
5. Generates a structured research brief with source IDs such as `[S1]`.
6. Displays the research response and clickable retrieved sources in the dashboard.

## Architecture

```text
Research Question
       ↓
Next.js Dashboard
       ↓
Research API Route
       ↓
┌──────┴────────┐
↓               ↓
Wikipedia     arXiv
↓               ↓
└──────┬────────┘
       ↓
Retrieved Evidence
       ↓
OpenRouter Free LLM
       ↓
Grounded Synthesis
       ↓
Research Report + Source IDs
```

## Current MVP

- Research dashboard with recent sessions and workspace metrics
- Natural-language research query interface
- Live source retrieval from Wikipedia and arXiv
- Retrieval-augmented prompt construction
- Source-grounded LLM synthesis
- Source ID citation mapping (`[S1]`, `[S2]`, etc.)
- Clickable source cards
- Responsive dark-mode UI
- OpenRouter free-model integration

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- OpenRouter API
- Wikipedia MediaWiki API
- arXiv API
- Custom CSS

## Environment variables

Create `.env.local` locally:

```env
OPENROUTER_API_KEY=your_key_here
```

Never commit `.env.local` or expose API keys in source code.

## Running locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Roadmap

- [x] LLM-powered research generation
- [x] Web/source retrieval
- [x] Source-grounded generation
- [x] Citation tracking
- [ ] Document upload and parsing
- [ ] Embeddings and vector retrieval
- [ ] PostgreSQL research history
- [ ] Research report export
- [ ] Docker Compose setup
- [ ] Automated retrieval/generation evaluation

## Important limitation

The current MVP retrieves evidence from Wikipedia and arXiv and asks the LLM to ground its response in that retrieved context. It should not be treated as a fully verified academic search engine. Retrieved source quality and coverage depend on the external APIs, and research claims should still be checked against the primary source before high-stakes use.

## Why this project?

The project explores how LLMs, retrieval systems, source provenance, and full-stack application architecture can be combined to make research workflows faster and more traceable.
