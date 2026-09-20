import React, { useState } from 'react';
import { 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Search, 
  ChevronRight, 
  ExternalLink,
  ShieldCheck,
  Zap,
  Layers,
  ArrowUpRight
} from 'lucide-react';

export default function MockWorkspacePreview({ onOpenAuth }) {
  const [activeCitation, setActiveCitation] = useState({
    id: 1,
    docName: 'Deep_Learning_Methodologies_2025.pdf',
    page: 4,
    similarity: 94,
    snippet: 'Across the comparative trial, multi-task pre-training improved sample efficiency by 34% compared to standard sequential fine-tuning, demonstrating robust cross-domain generalization.'
  });

  const [drawerOpen, setDrawerOpen] = useState(true);

  return (
    <div className="relative rounded-2xl md:rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl overflow-hidden text-left">
      {/* Browser Chrome Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className="ml-3 text-xs font-mono text-slate-400 hidden sm:inline-block">
            pagesense.online/session/thesis-research
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Session
          </span>
        </div>
      </div>

      {/* Main Workspace Preview Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[440px] text-xs">
        
        {/* Left Sidebar: Document List */}
        <div className="lg:col-span-3 border-r border-slate-800 bg-slate-950/40 p-3.5 space-y-3">
          <div className="flex items-center justify-between text-slate-400 font-medium">
            <span className="uppercase text-[10px] tracking-wider">Documents (3)</span>
            <span className="text-[10px] text-indigo-400">Indexed</span>
          </div>

          <div className="space-y-2">
            {/* Doc 1 */}
            <div className="p-2.5 rounded-xl bg-slate-900 border border-indigo-500/30 text-white shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="truncate font-medium">Deep_Learning_Methodologies_2025.pdf</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded">
                  Ready
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                <span>18 Pages • 640 KB</span>
                <span className="text-slate-400">22 Chunks</span>
              </div>
            </div>

            {/* Doc 2 */}
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-300">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="truncate font-medium">Survey_Literature_Review.docx</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded">
                  Ready
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                <span>32 Pages • 1.1 MB</span>
                <span className="text-slate-400">41 Chunks</span>
              </div>
            </div>

            {/* Doc 3 */}
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-300">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate font-medium">Field_Study_Notes.png</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded">
                  Ready
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                <span>1 Page • OCR Extracted</span>
                <span className="text-slate-400">3 Chunks</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <div className="p-2.5 rounded-xl border border-dashed border-slate-800 text-center text-slate-400 text-[11px]">
              <span>+ Drag & drop more files (max 5 files, up to 10MB each)</span>
            </div>
          </div>
        </div>

        {/* Center Panel: Natural Language Chat Interface */}
        <div className="lg:col-span-5 p-4 flex flex-col justify-between border-r border-slate-800/80 bg-slate-900/30">
          <div className="space-y-4">
            {/* User Message */}
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-indigo-600 text-white p-3 shadow-md">
                <p className="text-xs leading-relaxed">
                  How did the experimental methodology in the 2025 paper improve upon the prior literature review?
                </p>
              </div>
            </div>

            {/* Assistant Streaming Response */}
            <div className="flex justify-start">
              <div className="max-w-[95%] rounded-2xl bg-slate-950 border border-slate-800 p-3.5 space-y-2.5 text-slate-200">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                  <span>Synthesized Answer</span>
                  <span className="text-[10px] text-indigo-400/80 font-medium ml-auto bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-800/40">Multi-Model RAG</span>
                </div>

                <p className="text-xs leading-relaxed text-slate-300">
                  The 2025 study introduced a multi-task pre-training framework that improved sample efficiency by{' '}
                  <strong className="text-white font-semibold">34%</strong>{' '}
                  <button 
                    onClick={() => {
                      setActiveCitation({
                        id: 1,
                        docName: 'Deep_Learning_Methodologies_2025.pdf',
                        page: 4,
                        similarity: 94,
                        snippet: 'Across the comparative trial, multi-task pre-training improved sample efficiency by 34% compared to standard sequential fine-tuning, demonstrating robust cross-domain generalization.'
                      });
                      setDrawerOpen(true);
                    }}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 font-mono text-[10px] align-baseline transition"
                  >
                    [1] p.4
                  </button>
                  . In contrast to the sequential approaches documented in the survey paper{' '}
                  <button 
                    onClick={() => {
                      setActiveCitation({
                        id: 2,
                        docName: 'Survey_Literature_Review.docx',
                        page: 12,
                        similarity: 88,
                        snippet: 'Prior sequential architectures experienced catastrophic forgetting when transitioning between divergent evaluation datasets.'
                      });
                      setDrawerOpen(true);
                    }}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 font-mono text-[10px] align-baseline transition"
                  >
                    [2] p.12
                  </button>
                  , this approach prevented catastrophic forgetting across divergent domains.
                </p>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
                  <span>Grounding: 2 direct citations</span>
                  <span>•</span>
                  <span>Cosine Similarity: 94%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Prompt Input Box */}
          <div className="mt-4 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-400">
              <input 
                type="text" 
                readOnly
                placeholder="Ask follow-up or cross-examine documents..."
                className="bg-transparent text-xs text-white placeholder-slate-500 w-full focus:outline-none cursor-pointer"
                onClick={onOpenAuth}
              />
              <button 
                onClick={onOpenAuth}
                className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Source Citation Inspection Drawer */}
        <div className="lg:col-span-4 p-4 bg-slate-950/60 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <h4 className="font-semibold text-slate-200">Citation Inspector</h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                Citation [{activeCitation.id}]
              </span>
            </div>

            {/* Document Reference Badge */}
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-200 truncate">{activeCitation.docName}</span>
                <span className="text-[10px] text-slate-400">Page {activeCitation.page}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="text-emerald-400 font-medium">{activeCitation.similarity}% Confidence Match</span>
                <span>Vector Chunk #4</span>
              </div>
            </div>

            {/* Verbatim Extracted Excerpt */}
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Verified Document Excerpt
              </span>
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 leading-relaxed font-serif text-[11px] italic border-l-2 border-l-indigo-500">
                "{activeCitation.snippet}"
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Tamper-proof S3 Presigned URL</span>
            <button 
              onClick={onOpenAuth}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              Verify in Source <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
