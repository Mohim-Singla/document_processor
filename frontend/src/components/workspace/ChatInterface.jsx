import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, AlertCircle, Quote, RotateCw, Archive, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatInterface({
  messages,
  onSendMessage,
  onRetry,
  isStreaming,
  currentStreamText,
  onSelectCitation,
  isArchived = false,
  onRestore,
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-focus the input when user starts typing anywhere on the page
  // If there is text in the text box and user presses Enter, send the message
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip if modifier keys are held (allow browser/OS shortcuts)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Skip if streaming (input is disabled)
      if (isStreaming) return;

      // Skip if session is archived (no input to focus)
      if (isArchived) return;

      // Skip if already focused on an interactive element
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isEditable = document.activeElement?.isContentEditable;
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || isEditable) return;

      // If user presses Enter anywhere in session workspace:
      // If there is text, send the message
      if (e.key === 'Enter') {
        if (tag === 'button' || tag === 'a') return;
        if (input.trim()) {
          e.preventDefault();
          onSendMessage?.(input.trim());
          setInput('');
        }
        return;
      }

      // Skip non-printable keys (arrows, function keys, Escape, Tab, etc.)
      if (e.key.length !== 1) return;

      // Focus the input — the browser will naturally insert the typed character
      inputRef.current?.focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [input, isStreaming, isArchived, onSendMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamText]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 rounded-xl sm:rounded-2xl border border-slate-800/80 overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto space-y-4 sm:space-y-6">
        {messages.length === 0 && !isStreaming && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
            <div className="p-4 rounded-2xl bg-indigo-500/10 text-indigo-400 mb-3">
              <Sparkles className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-semibold text-slate-300">Ask Anything About Your Documents</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Google Gemini Pro will analyze your uploaded files, retrieve relevant snippets, and synthesize answers with citations.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isLastMessage = idx === messages.length - 1;
          const isUnansweredUser = isLastMessage && msg.sender === 'USER' && !isStreaming;

          return (
            <div key={idx} className="space-y-2">
              <div
                className={`flex items-start gap-3.5 ${msg.sender === 'USER' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ASSISTANT' && (
                  <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${
                    msg.sender === 'USER'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15'
                      : 'bg-slate-950/80 border border-slate-800 text-slate-200 shadow-md'
                  }`}
                >
                  {msg.sender === 'USER' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose prose-invert prose-xs max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Source Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                        <Quote className="w-3 h-3 text-indigo-400" /> Sources:
                      </span>
                      {msg.citations.map((cite, cIdx) => (
                        <button
                          key={cIdx}
                          onClick={() => onSelectCitation(cite)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[10px] text-slate-300 hover:text-white transition"
                        >
                          [{cIdx + 1}] {cite.fileName} {cite.pageNumber ? `(p. ${cite.pageNumber})` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {msg.sender === 'USER' && (
                  <div className="p-2 rounded-xl bg-slate-800 text-slate-300 shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>

              {/* Retry Action for Unanswered User Message */}
              {isUnansweredUser && onRetry && (
                <div className="flex justify-end pr-11">
                  <button
                    onClick={() => onRetry(msg.content)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 shadow-sm transition group"
                  >
                    <RotateCw className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" />
                    <span>Retry generating response</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Live Streaming Response Bubble */}
        {isStreaming && (
          <div className="flex items-start gap-3.5 justify-start animate-in fade-in duration-200">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 shrink-0 mt-0.5">
              <Bot className="w-4 h-4" />
            </div>
            <div className="max-w-2xl rounded-2xl p-4 text-xs leading-relaxed bg-slate-950/80 border border-slate-800 text-slate-200 shadow-md">
              <div className="prose prose-invert prose-xs max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {currentStreamText || 'Analyzing documents...'}
                </ReactMarkdown>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-indigo-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                Gemini Pro is typing...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Prompt Box / Archived Banner */}
      {isArchived ? (
        <div className="p-2 sm:p-4 bg-slate-950 border-t border-slate-800/80 flex justify-center">
          <div className="w-full max-w-sm sm:max-w-none flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 rounded-xl bg-amber-950/30 border border-amber-800/50 px-3.5 py-3 sm:px-4 sm:py-2.5 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2.5">
              <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className="text-[11px] sm:text-xs text-amber-300/90 leading-snug">
                Session is archived. Restore to upload documents or ask questions.
              </span>
            </div>
            {onRestore && (
              <button
                type="button"
                onClick={onRestore}
                className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-[11px] sm:text-xs font-semibold transition shadow-sm shrink-0"
              >
                <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Restore Session</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-2.5 sm:p-4 bg-slate-950 border-t border-slate-800/80">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask a question about the uploaded documents in this session..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isStreaming}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 pl-3.5 sm:pl-4 pr-11 sm:pr-12 py-2.5 sm:py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="absolute right-1.5 sm:right-2 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-30 text-white transition shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
