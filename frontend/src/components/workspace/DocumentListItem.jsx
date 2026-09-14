import React from 'react';
import { FileText, CheckCircle2, Clock, AlertTriangle, ExternalLink, Trash2, Loader2 } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export default function DocumentListItem({ doc, onPreview, onDelete }) {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Ready
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-400 bg-indigo-950/60 border border-indigo-800/50 px-2 py-0.5 rounded-full animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" /> Processing
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-950/60 border border-red-800/50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3" /> Queued
          </span>
        );
    }
  };

  return (
    <div className="group flex items-center justify-between p-3 rounded-xl bg-slate-950/40 hover:bg-slate-900 border border-slate-800/60 hover:border-slate-700 transition">
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <div className="p-2 rounded-lg bg-slate-800 text-indigo-400 shrink-0">
          <FileText className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate group-hover:text-white transition" title={doc.fileName}>
            {doc.fileName}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
            <span>{formatBytes(doc.fileSize)}</span>
            {doc.pageCount > 0 && <span>• {doc.pageCount} pgs</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {getStatusBadge(doc.status)}

        <div className="flex items-center opacity-0 group-hover:opacity-100 transition">
          {doc.status === 'READY' && onPreview && (
            <button
              onClick={() => onPreview(doc)}
              title="Preview original"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(doc.documentId)}
              title="Delete document"
              className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
