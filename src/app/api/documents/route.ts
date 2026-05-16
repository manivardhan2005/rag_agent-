import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const documentsPath = path.join(process.cwd(), "available_documents.json");
    if (!fs.existsSync(documentsPath)) {
      return NextResponse.json([]);
    }
    
    const data = fs.readFileSync(documentsPath, "utf-8");
    const documents = JSON.parse(data);
    
    return NextResponse.json(documents);
  } catch (error: any) {
    console.error("Error reading available documents:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
