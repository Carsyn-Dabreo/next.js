import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "fs/promises";
import path from "path";
import { authOptions } from "../auth/[...nextauth]/route";

export const runtime = "nodejs";
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "history.json");

type HistorySource = { id: string; title: string; url: string; snippet: string; type: string };
type HistoryItem = { id: string; userEmail: string; query: string; answer: string; sources: HistorySource[]; createdAt: string };

async function readStore(): Promise<HistoryItem[]> {
  try { return JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as HistoryItem[]; } catch { return []; }
}
async function writeStore(items: HistoryItem[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf8");
}
async function getUserEmail() {
  const session = await getServerSession(authOptions);
  return session?.user?.email?.toLowerCase() || null;
}

export async function GET() {
  const email = await getUserEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await readStore();
  const userItems = items.filter((item) => item.userEmail === email).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ sessions: userItems, count: userItems.length });
}

export async function POST(request: NextRequest) {
  const email = await getUserEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    if (!body.query || typeof body.query !== "string") return NextResponse.json({ error: "Query is required." }, { status: 400 });
    const item: HistoryItem = {
      id: `research_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userEmail: email,
      query: body.query.trim(),
      answer: typeof body.answer === "string" ? body.answer : "",
      sources: Array.isArray(body.sources) ? body.sources : [],
      createdAt: new Date().toISOString(),
    };
    const items = await readStore();
    items.unshift(item);
    await writeStore(items.slice(0, 250));
    return NextResponse.json({ success: true, session: item });
  } catch (error) {
    console.error("History save error:", error);
    return NextResponse.json({ error: "Could not save research history." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const email = await getUserEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await request.json();
    const items = await readStore();
    await writeStore(items.filter((item) => !(item.id === id && item.userEmail === email)));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Could not delete history item." }, { status: 500 });
  }
}
