import React, { useEffect, useState } from 'react';
import { X, Download, FileText, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';
import Tooltip from '../common/Tooltip';

export default function DocumentPreviewModal({
  isOpen,
  onClose,
  doc,
  previewData,
  loading,
}) {
  const [iframeLoading, setIframeLoading] = useState(true);

  const previewUrl = previewData?.url || '';
  const downloadUrl = previewData?.downloadUrl || previewData?.url || '';
  const summary = previewData?.summary || doc?.summary || null;
  const fileName = doc?.fileName || previewData?.fileName || 'Document';
  const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(fileExt);
  const hasTextPreview = previewData?.previewText !== null && previewData?.previewText !== undefined;
  const isTruncated = previewData?.isTruncated;

  useEffect(() => {
    setIframeLoading(true);
  }, [previewUrl]);

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !doc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="h-14 border-b border-slate-800 px-5 flex items-center justify-between bg-slate-900/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate max-w-md" title={fileName}>
                {fileName}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                {(doc.fileSize || previewData?.fileSize) && (
                  <span>{formatBytes(doc.fileSize || previewData?.fileSize)}</span>
                )}
                {(doc.pageCount > 0 || previewData?.pageCount > 0) && (
                  <span>• {doc.pageCount || previewData?.pageCount} pages</span>
                )}
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {downloadUrl && (
              <Tooltip content="Download file" position="bottom">
                <a
                  href={downloadUrl}
                  download={fileName}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              </Tooltip>
            )}

            <div className="h-4 w-px bg-slate-800 mx-1" />

            <Tooltip content="Close (Esc)" position="bottom">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* AI Summary on Top (if available) */}
        {summary && (
          <div className="bg-indigo-950/30 border-b border-indigo-500/20 px-5 py-3 shrink-0">
            <div className="flex items-center gap-1.5 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI Executive Summary</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed max-h-24 overflow-y-auto">
              {summary}
            </p>
          </div>
        )}

        {/* Truncation Warning Banner */}
        {isTruncated && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2.5 flex items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2 text-amber-300 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">
                Preview truncated: Showing the first 250 KB of this file ({formatBytes(doc.fileSize || previewData?.fileSize)} total).
              </span>
            </div>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={fileName}
                className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 shrink-0 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                Download Full File
              </a>
            )}
          </div>
        )}

        {/* Original File Preview Body */}
        <div className="flex-1 bg-slate-950 relative flex items-center justify-center overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span>Loading preview...</span>
            </div>
          ) : hasTextPreview ? (
            <div className="w-full h-full overflow-auto bg-slate-950 p-5 select-text">
              <pre className="font-mono text-xs text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                {previewData.previewText}
              </pre>
            </div>
          ) : !previewUrl ? (
            <div className="text-slate-400 text-xs text-center p-6">
              Preview link unavailable. Please use the download option above.
            </div>
          ) : isImage ? (
            <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
              <img
                src={previewUrl}
                alt={fileName}
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            </div>
          ) : (
            <div className="w-full h-full relative bg-white">
              {iframeLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-10 text-slate-400 text-xs gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                  <span>Loading document...</span>
                </div>
              )}
              <iframe
                src={`${previewUrl}#toolbar=1`}
                title={fileName}
                className="w-full h-full border-0 bg-white"
                onLoad={() => setIframeLoading(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
