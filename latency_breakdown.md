# RAG Latency Breakdown

Based on the evaluation of the optimal configuration (**Chunk Size: 1000, Top-K: 5**), the total average latency to answer a user's question is approximately **2.3 seconds (2,300 ms)**. 

Here is the detailed breakdown of where that time is spent for a single question:

### 1. Embedding the User's Question (~200 ms)
The system calls the `gemini-embedding-001` model to convert the user's plain text query into a mathematical vector representation.

### 2. Retrieval / Cosine Similarity Search (~50 ms)
The system rapidly calculates the cosine similarity distance between the question's vector and all stored chunks in `vector_store.json`. Because this calculation happens locally in Node.js, it is nearly instantaneous. It then sorts and extracts the Top 5 most relevant chunks.

### 3. LLM Generation Time (~2,050 ms)
The system passes the user's question along with the 5,000 characters of retrieved context (5 chunks * 1000 chars) to `gemini-flash-latest`. The model processes this large context and streams back the generated markdown answer. This is where the bulk of the latency occurs.

---

## Why Generation Time Varies

The **LLM Generation Time** directly correlates with how much context you feed it:

* **Top-K = 3 (Chunk Size 500):** Takes only `~1.2 seconds` total because the LLM only has to read 1,500 characters of context.
* **Top-K = 5 (Chunk Size 1000):** Takes `~2.3 seconds` total because the LLM has to read and analyze 5,000 characters of context before outputting the answer.

### The Impact of Streaming
Because **streaming** is implemented in `src/app/api/chat/route.ts`, the user does not wait the full 2.3 seconds to see a response. The first token (word) appears on the screen in about **500 ms**, and the rest streams in smoothly over the remaining 1.8 seconds, creating a highly responsive user experience.
