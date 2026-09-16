import React from 'react';
import { ServerOff, AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function ErrorView({
  title = 'Unable to Connect to Server',
  subtitle = 'We were unable to reach the Document Processor backend service. Please check your connection or verify that the server is running.',
  error = null,
  errorCode = '503',
  onRetry = null,
  onGoHome = null,
  compact = false,
}) {
  const errorMessage = error?.message || (typeof error === 'string' ? error : 'Unknown error');

  const handleDefaultGoHome = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      window.location.href = '/';
    }
  };

  const handleDefaultRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      className={`flex items-center justify-center bg-slate-950 p-6 selection:bg-indigo-500 selection:text-white ${
        compact ? 'min-h-[400px] w-full' : 'min-h-screen w-full'
      }`}
    >
      <div className="w-full max-w-lg text-center">
        {/* Error Icon */}
        <div className="inline-flex p-4 rounded-3xl bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20 shadow-xl shadow-rose-500/10 mb-6 animate-in zoom-in-95 duration-300">
          {errorCode === '503' || errorMessage.toLowerCase().includes('connect') || errorMessage.toLowerCase().includes('fetch') ? (
            <ServerOff className="w-10 h-10" />
          ) : (
            <AlertTriangle className="w-10 h-10" />
          )}
        </div>

        {/* Status Badge */}
        {errorCode && (
          <div className="mb-3">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-rose-950/60 border border-rose-500/30 text-rose-300">
              {errorCode} • Service Error
            </span>
          </div>
        )}

        {/* Title & Subtitle */}
        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
          {title}
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto mb-8">
          {subtitle}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleDefaultRetry}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>

          <button
            type="button"
            onClick={handleDefaultGoHome}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>
    </div>
  );
}
