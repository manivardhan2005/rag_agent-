# 💧 DC Water RAG Agent

![Next.js](https://img.shields.io/badge/Next.js-Black?style=for-the-badge&logo=next.js)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-API-blue?style=for-the-badge&logo=google)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

An intelligent Retrieval-Augmented Generation (RAG) assistant designed to help users quickly find answers from the official [DC Water documentation](https://www.dcwater.com).

## ✨ Features

- **Massive Knowledge Base**: Queries against an embedded vector store of over 900+ crawled HTML pages from DC Water.
- **Real-Time Streaming**: Delivers fast, chunked text responses so you don't have to wait for the entire answer to generate.
- **Conversational Memory**: Remembers context from previous interactions for a natural chat experience.
- **Force Stop Mechanism**: Interrupt the AI mid-generation if you already have the answer you need.
- **Smart Follow-Ups**: Automatically generates contextual AI-suggested follow-up questions to guide your exploration.
- **Document Filtering**: Focus your queries on specific subsets of the DC Water documentation.

## 🏗️ Architecture

1. **Ingestion Pipeline**: Parses HTML pages, chunks the text, and generates embeddings using the Google Gemini API.
2. **Vector Store**: A lightweight local vector store (`vector_store.json`) that manages embeddings and metadata for efficient similarity search.
3. **Retrieval**: Uses semantic search to fetch the most relevant document chunks based on user queries.
4. **Generation**: The Gemini model synthesizes an accurate response utilizing the retrieved context, returning clean structured output.
5. **Frontend**: Built with React and Next.js, featuring a clean, responsive chat interface.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/manivardhan2005/rag_agent-.git
   cd rag_agent-
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Environment Variables**
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_google_gemini_api_key_here
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   ```

5. **Open the App**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## 🛠️ Data Ingestion (Optional)
If you want to re-run the embedding process or add new documents:
```bash
npx tsx scripts/ingest.ts
```
*Note: This requires valid API credentials and might consume a significant amount of API quota depending on the dataset size.*

## 📜 License
This project is open-source and available under the MIT License.
