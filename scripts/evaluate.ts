import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const TEST_FILES = [
  "output/www.dcwater.com/faq.md",
  "output/www.dcwater.com/paying-your-bill.md",
  "output/www.dcwater.com/cleanrivers.md"
];

const QUESTIONS = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scripts/test_questions.json"), "utf8"));

// Config matrix
const CHUNK_SIZES = [500, 1000];
const TOP_KS = [3, 5];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function runEvaluation() {
  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-flash-latest",
    maxOutputTokens: 1024,
  });

  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
  });

  let report = `# RAG Evaluation Report\n\n`;
  report += `This report evaluates the effect of different Chunk Sizes and Top-K values on a small subset of the corpus.\n\n`;
  report += `| Chunk Size | Top K | Avg Context Relevance (1-5) | Avg Answer Quality (1-5) | Avg Latency (ms) |\n`;
  report += `|---|---|---|---|---|\n`;

  for (const chunkSize of CHUNK_SIZES) {
    console.log(`\n=== Testing Chunk Size: ${chunkSize} ===`);
    
    // 1. Ingestion Phase for this Chunk Size
    const documents: Document[] = [];
    for (const relPath of TEST_FILES) {
      const fullPath = path.join(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      documents.push(new Document({ pageContent: content, metadata: { source: relPath } }));
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: chunkSize,
      chunkOverlap: Math.floor(chunkSize * 0.2), // 20% overlap
    });

    const splitDocs = await splitter.splitDocuments(documents);
    console.log(`Created ${splitDocs.length} chunks.`);

    // Embed
    const vectorStore: { content: string; embedding: number[]; metadata: any }[] = [];
    const batchEmbeddings = await embeddings.embedDocuments(splitDocs.map(d => d.pageContent));
    for (let j = 0; j < splitDocs.length; j++) {
      vectorStore.push({
        content: splitDocs[j].pageContent,
        embedding: batchEmbeddings[j],
        metadata: splitDocs[j].metadata,
      });
    }

    // 2. Evaluation Phase
    for (const k of TOP_KS) {
      console.log(`  -> Evaluating Top K: ${k}`);
      let totalRelevance = 0;
      let totalQuality = 0;
      let totalLatency = 0;

      for (const qObj of QUESTIONS) {
        const question = qObj.question;
        const start = Date.now();

        // Retrieve
        const questionEmbedding = await embeddings.embedQuery(question);
        const results = vectorStore.map((vec) => ({
          ...vec,
          similarity: cosineSimilarity(questionEmbedding, vec.embedding),
        }));
        results.sort((a, b) => b.similarity - a.similarity);
        const topK = results.slice(0, k);

        const contextStr = topK.map((res) => res.content).join("\n\n---\n\n");

        // Generate Answer
        const prompt = PromptTemplate.fromTemplate(`Use context to answer question. Context: {context}\nQuestion: {question}\nAnswer:`);
        const chain = prompt.pipe(llm).pipe(new StringOutputParser());
        const answer = await chain.invoke({ context: contextStr, question });
        
        totalLatency += (Date.now() - start);

        // Evaluate Relevance
        const evalRelPrompt = PromptTemplate.fromTemplate(`
          You are an expert evaluator. Given a question and a retrieved context, score how RELEVANT the context is to answering the question on a scale of 1 to 5.
          Provide ONLY the integer number as your response.
          Question: {question}
          Context: {context}
          Score (1-5):`);
        const evalRelChain = evalRelPrompt.pipe(llm).pipe(new StringOutputParser());
        const relScoreStr = await evalRelChain.invoke({ context: contextStr, question });
        const relScore = parseInt(relScoreStr.trim()) || 0;
        totalRelevance += relScore;

        // Evaluate Quality
        const evalQualPrompt = PromptTemplate.fromTemplate(`
          You are an expert evaluator. Given a question, context, and a generated answer, score the QUALITY and ACCURACY of the answer on a scale of 1 to 5.
          Provide ONLY the integer number as your response.
          Question: {question}
          Context: {context}
          Answer: {answer}
          Score (1-5):`);
        const evalQualChain = evalQualPrompt.pipe(llm).pipe(new StringOutputParser());
        const qualScoreStr = await evalQualChain.invoke({ context: contextStr, question, answer });
        const qualScore = parseInt(qualScoreStr.trim()) || 0;
        totalQuality += qualScore;

        await delay(8000); // Rate limit protection
      }

      const numQ = QUESTIONS.length;
      const avgRel = (totalRelevance / numQ).toFixed(2);
      const avgQual = (totalQuality / numQ).toFixed(2);
      const avgLat = Math.round(totalLatency / numQ);

      console.log(`     Relevance: ${avgRel}, Quality: ${avgQual}, Latency: ${avgLat}ms`);
      report += `| ${chunkSize} | ${k} | ${avgRel} | ${avgQual} | ${avgLat} |\n`;
    }
  }

  // Save report to artifact directory
  const reportPath = path.join(process.cwd(), "evaluation_report.md");
  fs.writeFileSync(reportPath, report);
  console.log(`Evaluation complete! Report saved to ${reportPath}`);
}

runEvaluation().catch(console.error);
