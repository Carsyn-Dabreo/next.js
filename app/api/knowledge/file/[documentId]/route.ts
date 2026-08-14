import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "knowledge-base.json");
const DOCUMENTS_DIR = path.join(DATA_DIR, "documents");

type DocumentRecord = {
  id: string;
  name: string;
  type: string;
  mimeType?: string;
};

type Store = {
  documents: DocumentRecord[];
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;

    if (!/^doc_[a-zA-Z0-9_-]+$/.test(documentId)) {
      return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
    }

    const store = JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as Store;
    const document = store.documents.find((item) => item.id === documentId);

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const file = await fs.readFile(path.join(DOCUMENTS_DIR, documentId));
    return new NextResponse(file, {
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${document.name.replace(/[\\\"]/g, "_")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Knowledge Base document viewer error:", error);
    return NextResponse.json({ error: "Document file is not available. Please re-upload it." }, { status: 404 });
  }
}
