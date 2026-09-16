import React from 'react';
import { FileText, CheckCircle2, Clock, AlertTriangle, ExternalLink, Trash2, Loader2, RotateCw } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';
import Tooltip from '../common/Tooltip';

export default function DocumentListItem({ doc, onPreview, onDelete, onRetry }) {
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
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-950/60 border border-red-800/50 px-2 py-0.5 rounded-full"
          >
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
    <div className="group relative flex items-center justify-between p-3 rounded-xl bg-slate-950/40 hover:bg-slate-900 border border-slate-800/60 hover:border-slate-700 transition">
      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
        <div className="p-2 rounded-lg bg-slate-800 text-indigo-400 shrink-0">
          <FileText className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1 relative group/title">
          <p className="text-xs font-medium text-slate-200 truncate group-hover/title:text-white transition cursor-default">
            {doc.fileName}
          </p>

          {/* Pop-up Tooltip on Hover with 400ms delay */}
          <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 opacity-0 invisible group-hover/title:opacity-100 group-hover/title:visible transition-all duration-200 delay-0 group-hover/title:delay-[400ms] z-50 w-max max-w-[280px] rounded-lg bg-slate-900/95 backdrop-blur-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-100 shadow-2xl break-all">
            {doc.fileName}
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
            <span>{formatBytes(doc.fileSize)}</span>
            {doc.pageCount > 0 && <span>• {doc.pageCount} pgs</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {/* Hover action buttons (Preview, Delete) - Only take space on hover */}
        <div className="hidden group-hover:flex items-center gap-1">
          {doc.status === 'READY' && onPreview && (
            <Tooltip content="Preview document" position="top">
              <button
                type="button"
                onClick={() => onPreview(doc)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip content="Delete document" position="top">
              <button
                type="button"
                onClick={() => onDelete(doc.documentId)}
                className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Dedicated Retry button to the left of Error badge */}
        {doc.status === 'FAILED' && onRetry && (
          <Tooltip content="Retry document processing" position="top">
            <button
              type="button"
              onClick={() => onRetry(doc.documentId)}
              className="p-1 rounded-md text-amber-400 hover:text-amber-200 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-700/60 hover:border-amber-500 transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        )}

        {/* Status Badge */}
        <div className="flex justify-end shrink-0">
          {getStatusBadge(doc.status)}
        </div>
      </div>
    </div>
  );
}
