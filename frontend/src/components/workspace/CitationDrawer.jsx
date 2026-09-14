import React from 'react';
import { X, FileText, ExternalLink, Quote } from 'lucide-react';

export default function CitationDrawer({ isOpen, onClose, citation, onPreviewOriginal }) {
  if (!isOpen || !citation) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Quote className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-white text-sm">Source Citation Reference</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span className="font-medium text-slate-200 truncate">{citation.fileName}</span>
              </div>
              {citation.pageNumber && (
                <div className="mt-1 text-[11px] text-slate-500 pl-6">
                  Page Reference: <span className="text-slate-300 font-medium">{citation.pageNumber}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Extracted Snippet
              </label>
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap font-mono">
                {citation.snippet || 'No text snippet available.'}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800">
          <button
            onClick={() => onPreviewOriginal(citation.documentId)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-lg shadow-indigo-600/20"
          >
            <ExternalLink className="w-4 h-4" />
            Open Original File (S3)
          </button>
        </div>
      </div>
    </div>
  );
}
