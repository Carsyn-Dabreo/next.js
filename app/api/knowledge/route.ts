import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "knowledge-base.json");

type Chunk = {
  id: string;
  documentId: string;
  documentName: string;
  text: string;
};

type DocumentRecord = {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  chunks: number;
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

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (extension === "pdf" || file.type === "application/pdf") {
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } else {
      text = buffer.toString("utf8");
    }

    if (!text.trim()) {
      return NextResponse.json({ error: "No readable text was found in the document." }, { status: 400 });
    }

    const store = await readStore();
    const documentId = `doc_${Date.now()}`;
    const pieces = chunkText(text);

    const document: DocumentRecord = {
      id: documentId,
      name: file.name,
      type: extension ?? file.type,
      size: file.size,
      createdAt: new Date().toISOString(),
      chunks: pieces.length,
    };

    const newChunks: Chunk[] = pieces.map((piece, index) => ({
      id: `${documentId}_chunk_${index + 1}`,
      documentId,
      documentName: file.name,
      text: piece,
    }));

    store.documents.unshift(document);
    store.chunks.push(...newChunks);
    await writeStore(store);

    return NextResponse.json({
      success: true,
      document,
      chunkCount: newChunks.length,
      message: `${file.name} was extracted and indexed into ${newChunks.length} searchable chunks.`,
    });
  } catch (error) {
    console.error("Knowledge Base upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to index document." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const documentId = body.documentId;
    const store = await readStore();
    store.documents = store.documents.filter((document) => document.id !== documentId);
    store.chunks = store.chunks.filter((chunk) => chunk.documentId !== documentId);
    await writeStore(store);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete document." }, { status: 500 });
  }
}
