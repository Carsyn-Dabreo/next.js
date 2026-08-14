# Research Command Center

An AI-powered research workspace designed to turn complex questions into structured, source-backed research.

## Overview

Research Command Center combines a modern web dashboard with an AI research pipeline. The product is designed around a retrieval-augmented generation (RAG) workflow: analyze a research question, retrieve relevant evidence, synthesize findings with an LLM, and present the result as an organized research report.

## Current MVP

- Research dashboard with recent sessions and workspace metrics
- Research query interface with example prompts
- Interactive research pipeline visualization
- Knowledge-base overview for documents, sources, and indexed collections
- Responsive dark-mode UI
- Frontend foundation ready for API/RAG integration

## Planned AI Pipeline

```text
Research Question
       ↓
Query Analysis
       ↓
Source Retrieval
       ↓
Document Chunking + Embeddings
       ↓
Vector Search / Ranking
       ↓
LLM Synthesis
       ↓
Citation Extraction
       ↓
Structured Research Report
```

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind-style custom CSS
- FastAPI / Python (planned backend)
- OpenAI API (planned LLM layer)
- PostgreSQL (planned persistence)
- Vector database / embeddings (planned RAG layer)
- Docker (planned deployment)

## Running locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Roadmap

- [ ] FastAPI backend
- [ ] LLM-powered query decomposition
- [ ] Web/source retrieval service
- [ ] Document upload and parsing
- [ ] Embedding and vector retrieval
- [ ] Source-grounded answer generation
- [ ] Citation tracking
- [ ] PostgreSQL persistence
- [ ] Docker Compose setup
- [ ] Evaluation and confidence scoring

## Why this project?

The project explores how LLMs, retrieval systems, and full-stack application architecture can be combined to make research workflows faster, more traceable, and easier to manage.
