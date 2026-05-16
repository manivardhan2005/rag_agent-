import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const OUTPUT_DIR = path.join(process.cwd(), "output");
const VECTOR_STORE_PATH = path.join(process.cwd(), "vector_store.json");
const AVAILABLE_DOCUMENTS_PATH = path.join(process.cwd(), "available_documents.json");

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if (!process.env.GOOGLE_API_KEY) {
    console.error("Missing GOOGLE_API_KEY in .env.local");
    process.exit(1);
  }

  const documents: Document[] = [];
  const uniqueSources = new Set<string>();
  
  function walkDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        walkDir(fullPath);
      } else if (fullPath.endsWith(".html")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const $ = cheerio.load(content);
        $("script, style, nav, header, footer, iframe, noscript").remove();
        let text = $("body").text().replace(/\s+/g, " ").trim();
        if (text.length > 50) {
          const source = fullPath.replace(OUTPUT_DIR, "");
          documents.push(new Document({
            pageContent: text,
            metadata: { source: source }
          }));
          uniqueSources.add(source);
        }
      } else if (fullPath.endsWith(".md")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (content.length > 50) {
          const source = fullPath.replace(OUTPUT_DIR, "");
          documents.push(new Document({
            pageContent: content,
            metadata: { source: source }
          }));
          uniqueSources.add(source);
        }
      }
    }
  }

  walkDir(OUTPUT_DIR);
  console.log(`Loaded ${documents.length} document chunks.`);

  fs.writeFileSync(AVAILABLE_DOCUMENTS_PATH, JSON.stringify(Array.from(uniqueSources)));
  console.log(`Successfully saved ${uniqueSources.size} unique documents to ${AVAILABLE_DOCUMENTS_PATH}.`);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const splitDocs = await splitter.splitDocuments(documents);
  console.log(`Created ${splitDocs.length} document chunks.`);

  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
  });

  const vectors: { content: string; embedding: number[]; metadata: any }[] = [];
  const BATCH_SIZE = 50; 
  
  for (let i = 0; i < splitDocs.length; i += BATCH_SIZE) {
    const batch = splitDocs.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${i / BATCH_SIZE + 1} / ${Math.ceil(splitDocs.length / BATCH_SIZE)}...`);
    try {
      const batchEmbeddings = await embeddings.embedDocuments(batch.map(d => d.pageContent));
      for (let j = 0; j < batch.length; j++) {
        vectors.push({
          content: batch[j].pageContent,
          embedding: batchEmbeddings[j],
          metadata: batch[j].metadata,
        });
      }
      await delay(3000); 
    } catch (error) {
      console.error(`Error processing batch ${i / BATCH_SIZE + 1}:`, error);
      await delay(10000);
      try {
        const batchEmbeddings = await embeddings.embedDocuments(batch.map(d => d.pageContent));
        for (let j = 0; j < batch.length; j++) {
          vectors.push({
            content: batch[j].pageContent,
            embedding: batchEmbeddings[j],
            metadata: batch[j].metadata,
          });
        }
      } catch (e) {
        console.error("Retry failed. Skipping batch.");
      }
    }
  }

  fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(vectors));
  console.log(`Successfully saved ${vectors.length} vectors to ${VECTOR_STORE_PATH}.`);
}

main().catch(console.error);
