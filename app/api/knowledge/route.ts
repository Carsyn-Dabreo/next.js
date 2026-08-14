import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";
import { PDFDocument } from "pdf-lib";
import { embedTexts } from "@/lib/embeddings";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "knowledge-base.json");
const DOCUMENTS_DIR = path.join(DATA_DIR, "documents");

type Chunk = {
  id: string;
  documentId: string;
  documentName: string;
  text: string;
  embedding?: number[];
};

type DocumentRecord = {
  id: string;
  name: string;
  type: string;
  mimeType: string;
  size: number;
  createdAt: string;
  chunks: number;
  embeddingModel?: string;
};

type Store = {
  documents: DocumentRecord[];
  chunks: Chunk[];
};

async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as Store;
  } catch {
    return { documents: [], chunks: [] };
  }
}

async function writeStore(store: Store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function chunkText(text: string, size = 1200, overlap = 180) {
  const clean = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + size, clean.length);
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

export async function GET() {
  const store = await readStore();
  return NextResponse.json({
    documents: store.documents,
    documentCount: store.documents.length,
    chunkCount: store.chunks.length,
    semanticSearch: store.chunks.some((chunk) => Array.isArray(chunk.embedding)),
    embeddingModel: "Xenova/all-MiniLM-L6-v2",
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }

    const allowed = ["application/pdf", "text/plain", "text/markdown"];
    const extension = file.name.toLowerCase().split(".").pop();
    if (!allowed.includes(file.type) && !["pdf", "txt", "md"].includes(extension ?? "")) {
      return NextResponse.json({ error: "Only PDF, TXT and Markdown files are supported." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File is too large. Maximum size is 10 MB." }, { status: 400 });
    }

    let buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (extension === "pdf" || file.type === "application/pdf") {
      try {
        const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
        const normalizedPdf = await pdf.save({ useObjectStreams: false, addDefaultPage: false });
        buffer = Buffer.from(normalizedPdf);
      } catch (repairError) {
        console.warn("PDF normalization skipped:", repairError);
      }
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } else {
      text = buffer.toString("utf8");
    }

    if (!text.trim()) {
      return NextResponse.json({ error: "No readable text was found in the document." }, { status: 400 });
    }

    const store = await readStore();
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const pieces = chunkText(text);
    const mimeType = file.type || (extension === "pdf" ? "application/pdf" : extension === "md" ? "text/markdown" : "text/plain");

    let embeddings: number[][] = [];
    let embeddingModel: string | undefined;
    try {
      embeddings = await embedTexts(pieces);
      embeddingModel = "Xenova/all-MiniLM-L6-v2";
    } catch (embeddingError) {
      console.warn("Semantic embedding generation failed; keeping lexical indexing:", embeddingError);
    }

    const document: DocumentRecord = {
      id: documentId,
      name: file.name,
      type: extension ?? file.type,
      mimeType,
      size: buffer.length,
      createdAt: new Date().toISOString(),
      chunks: pieces.length,
      embeddingModel,
    };

    const newChunks: Chunk[] = pieces.map((piece, index) => ({
      id: `${documentId}_chunk_${index + 1}`,
      documentId,
      documentName: file.name,
      text: piece,
      ...(embeddings[index] ? { embedding: embeddings[index] } : {}),
    }));

    await fs.mkdir(DOCUMENTS_DIR, { recursive: true });
    await fs.writeFile(path.join(DOCUMENTS_DIR, documentId), buffer);

    store.documents.unshift(document);
    store.chunks.push(...newChunks);
    await writeStore(store);

    const mode = embeddings.length === pieces.length ? "semantic embeddings + keyword indexing" : "keyword indexing";
    return NextResponse.json({
      success: true,
      document,
      chunkCount: newChunks.length,
      semanticSearch: embeddings.length === pieces.length,
      message: `${file.name} was extracted, normalized, saved and indexed into ${newChunks.length} searchable chunks using ${mode}.`,
    });
  } catch (error) {
    console.error("Knowledge Base upload error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to index document." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const documentId = body.documentId;
    const store = await readStore();
    const documentExists = store.documents.some((document) => document.id === documentId);
    store.documents = store.documents.filter((document) => document.id !== documentId);
    store.chunks = store.chunks.filter((chunk) => chunk.documentId !== documentId);
    if (documentExists) {
      try {
        await fs.unlink(path.join(DOCUMENTS_DIR, documentId));
      } catch {
        // Legacy upload or missing file.
      }
    }
    await writeStore(store);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete document." }, { status: 500 });
  }
}
