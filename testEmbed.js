const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
require("dotenv").config({ path: ".env.local" });

async function run() {
  try {
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-001",
    });
    console.log("Trying embedDocuments...");
    const res = await embeddings.embedDocuments(["hello world"]);
    console.log("embedDocuments success, length:", res[0].length);
  } catch (e) {
    console.error("embedDocuments failed:", e.message);
  }
}
run();
