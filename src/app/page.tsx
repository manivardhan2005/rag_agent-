"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  suggestedQuestions?: string[];
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: "assistant", 
      content: "Hello! I am your intelligent DC Water Assistant. I'm equipped to answer any questions about our services, water quality, billing, or policies. How can I help you today?" 
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableDocuments, setAvailableDocuments] = useState<string[]>([]);
  const [selectedDocument, setSelectedDocument] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/documents")
      .then(res => res.json())
      .then(data => setAvailableDocuments(data))
      .catch(console.error);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const submitQuery = async (queryToSubmit: string) => {
    if (!queryToSubmit.trim()) return;

    const controller = new AbortController();
    setAbortController(controller);

    const userMsg: Message = { role: "user", content: queryToSubmit };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Placeholder for assistant
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [...messages, userMsg],
          documentFilter: selectedDocument
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          
          let displayContent = fullContent;
          if (fullContent.includes("---SUGGESTED_QUESTIONS---")) {
             displayContent = fullContent.split("---SUGGESTED_QUESTIONS---")[0].trim();
          }
          
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].content = displayContent;
            return newMessages;
          });
        }
        
        if (fullContent.includes("---SUGGESTED_QUESTIONS---")) {
          const questionsRaw = fullContent.split("---SUGGESTED_QUESTIONS---")[1];
          const questions = questionsRaw
            .split('\n')
            .filter(q => q.trim().length > 0)
            .map(q => q.replace(/^[0-9\-\.\s]+/, '').trim());
            
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].suggestedQuestions = questions;
            return newMessages;
          });
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Generation stopped by user');
      } else {
        console.error(error);
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content += `\n\nError: ${error.message || "Failed to fetch response."}`;
          return newMessages;
        });
      }
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    submitQuery(input);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Premium Glassmorphic Header */}
      <header className="bg-slate-900/40 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between z-20 sticky top-0 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.4)]">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">DC Water Intelligence</h1>
            <p className="text-xs font-medium text-indigo-300/80 uppercase tracking-wider">AI Powered Agent</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <input 
              type="text"
              list="documents"
              value={selectedDocument}
              onChange={(e) => setSelectedDocument(e.target.value)}
              placeholder="Filter by document..."
              className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48"
            />
            <datalist id="documents">
              {availableDocuments.map(doc => <option key={doc} value={doc} />)}
            </datalist>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.6)]"></div>
            <span className="text-xs font-medium text-slate-400">System Online</span>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full max-w-5xl mx-auto flex flex-col gap-6 scroll-smooth">
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex flex-col max-w-[85%] md:max-w-[75%] ${msg.role === "user" ? "self-end items-end" : "self-start items-start"} animate-in fade-in slide-in-from-bottom-4 duration-500`}
          >
            {/* Avatar for Assistant */}
            {msg.role === "assistant" && (
              <div className="flex items-center gap-2 mb-2 ml-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-slate-400 tracking-wide">AI AGENT</span>
              </div>
            )}
            
            <div
              className={`p-5 shadow-2xl transition-all duration-300 hover:shadow-3xl ${
                msg.role === "user" 
                  ? "bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-3xl rounded-tr-sm" 
                  : "bg-slate-800/60 backdrop-blur-md border border-white/5 text-slate-200 rounded-3xl rounded-tl-sm"
              }`}
            >
              <div className="text-[15px] leading-relaxed break-words">
                {msg.content === "" && isLoading && idx === messages.length - 1 ? (
                  <div className="flex items-center gap-2 h-6 px-2">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }}></div>
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }}></div>
                  </div>
                ) : (
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
                    li: ({node, ...props}) => <li className="" {...props} />,
                    a: ({node, ...props}) => <a className="text-indigo-300 hover:text-indigo-200 hover:underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                    h1: ({node, ...props}) => <h1 className="text-xl font-bold text-white mb-2 mt-4" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-lg font-bold text-white mb-2 mt-4" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-base font-bold text-white mb-2 mt-3" {...props} />
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
                )}
              </div>

              {/* Suggested Questions Section */}
              {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                <div className="mt-4 pt-3 flex flex-wrap gap-2">
                  {msg.suggestedQuestions.map((q, i) => (
                    <button 
                      key={i}
                      onClick={() => submitQuery(q)}
                      className="text-[11px] font-medium bg-slate-800/80 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 text-indigo-200 hover:text-white px-3 py-1.5 rounded-full transition-all duration-200 text-left cursor-pointer hover:shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Force Stop Button is now in the input field */}
        <div ref={messagesEndRef} className="h-4" />
      </main>

      {/* Input Area */}
      <footer className="p-4 md:p-6 w-full max-w-5xl mx-auto">
        <form onSubmit={handleSubmit} className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <div className="relative flex items-center bg-slate-900 border border-slate-700/50 rounded-full shadow-2xl p-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Query the DC Water Knowledge Base..."
              className="flex-1 bg-transparent px-6 py-3 text-slate-200 placeholder-slate-500 focus:outline-none text-[15px]"
              disabled={isLoading}
              autoComplete="off"
            />
            
            {isLoading && abortController ? (
              <button
                type="button"
                onClick={stopGeneration}
                className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 hover:border-rose-500/50 shadow-lg hover:shadow-rose-500/25 hover:scale-105 active:scale-95 transition-all duration-200"
                title="Stop Generating"
              >
                <div className="w-3.5 h-3.5 bg-rose-500 rounded-[3px]"></div>
              </button>
            ) : (
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg hover:shadow-indigo-500/25 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all duration-200"
              >
                <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            )}
          </div>
        </form>
        <p className="text-center text-[11px] text-slate-500 mt-4 font-medium">
          Agent may produce inaccurate information. Always verify critical data with official sources.
        </p>
      </footer>
    </div>
  );
}
