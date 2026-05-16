import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import * as fs from "fs";
import * as path from "path";

// Define the shape of our stored vectors
type StoredVector = {
  content: string;
  embedding: number[];
  metadata: any;
};

// Global cache for the vector store so we don't load it on every request
let vectorStoreCache: StoredVector[] | null = null;

// Helper function to calculate cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Ensure the Edge runtime isn't used because we use fs
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { messages, documentFilter } = await req.json();
    const currentQuery = messages[messages.length - 1].content;
    const chatHistory = messages.slice(-7, -1);

    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-flash-latest",
      maxOutputTokens: 2048,
    });

    let standaloneQuery = currentQuery;
    if (chatHistory.length > 0) {
      const historyStr = chatHistory.map((m: any) => `${m.role}: ${m.content}`).join("\n");
      const reformulationPrompt = PromptTemplate.fromTemplate(`
Given the following conversation history and the user's latest input, rephrase the latest input into a standalone query that can be understood without the history.
Do not answer the question, just reformulate it.

History:
{history}

Latest Input: {query}
Standalone Query:`);
      const reformulateChain = reformulationPrompt.pipe(llm).pipe(new StringOutputParser());
      standaloneQuery = await reformulateChain.invoke({ history: historyStr, query: currentQuery });
    }

    // 1. Load the vector store if not already loaded
    if (!vectorStoreCache) {
      const vectorStorePath = path.join(process.cwd(), "vector_store.json");
      if (fs.existsSync(vectorStorePath)) {
        const data = fs.readFileSync(vectorStorePath, "utf-8");
        vectorStoreCache = JSON.parse(data);
        console.log(`Loaded ${vectorStoreCache?.length} vectors from disk.`);
      } else {
        return NextResponse.json(
          { error: "Vector store not found. Please run the ingestion script first." },
          { status: 500 }
        );
      }
    }

    // 2. Generate embedding for the user's question
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-001",
    });
    
    const questionEmbedding = await embeddings.embedQuery(standaloneQuery);

    // 3. Perform similarity search
    let vectorsToSearch = vectorStoreCache!;
    if (documentFilter) {
      vectorsToSearch = vectorsToSearch.filter(vec => vec.metadata.source.includes(documentFilter));
      if (vectorsToSearch.length === 0) {
        vectorsToSearch = vectorStoreCache!; // fallback if nothing found
      }
    }

    const results = vectorsToSearch.map((vec) => ({
      ...vec,
      similarity: cosineSimilarity(questionEmbedding, vec.embedding),
    }));

    // Sort by descending similarity and pick top 5
    results.sort((a, b) => b.similarity - a.similarity);
    const topK = results.slice(0, 5);

    // Combine context
    const contextStr = topK.map((res) => `Source: ${res.metadata.source}\nContent: ${res.content}`).join("\n\n---\n\n");

    const prompt = PromptTemplate.fromTemplate(`
You are a helpful and knowledgeable AI assistant for DC Water.
Use the following pieces of context retrieved from the DC Water website to answer the user's question.
If you don't know the answer based on the context, just say that you don't know, don't try to make up an answer.

Format your response beautifully using markdown.

IMPORTANT: At the very end of your response, you MUST provide 2-3 suggested follow-up questions the user might ask.
Format them exactly like this at the bottom:
---SUGGESTED_QUESTIONS---
- First question?
- Second question?

Context:
{context}

Question: {question}
Answer:`);

    const chain = prompt.pipe(llm).pipe(new StringOutputParser());

    // Call the LangChain stream method
    const stream = await chain.stream({
      context: contextStr,
      question: standaloneQuery,
    });

    // Create a ReadableStream to push chunks to the client immediately
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      }
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform"
      }
    });

  } catch (error: any) {
    console.error("Error in chat route:", error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
