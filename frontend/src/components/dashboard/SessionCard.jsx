import React, { useState, useRef, useEffect } from 'react';
import { Folder, MoreVertical, Archive, ArrowUpRight, Trash2, FileText, Clock, RotateCcw } from 'lucide-react';
import { formatRelativeTime } from '../../utils/formatters';

export default function SessionCard({ session, onSelect, onArchive, onRestore, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const isArchived = session.status === 'ARCHIVED';

  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMenu]);

  return (
    <div
      onClick={() => onSelect(session)}
      className="group relative flex flex-col justify-between rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-indigo-500/50 p-5 shadow-lg transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
    >
      <div>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${isArchived ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
              <Folder className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 pl-0.5">
              <h3 className="font-semibold text-slate-100 group-hover:text-indigo-300 transition line-clamp-1 leading-snug">
                {session.title}
              </h3>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {session.sessionId && (
                  <span className="inline-flex items-center text-[11px] font-mono font-medium text-slate-300 bg-slate-800 border border-slate-750 px-2 py-0.5 rounded-full shadow-xs">
                    #{session.sessionId.slice(-6)}
                  </span>
                )}
                <span className={`inline-flex items-center text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full ${
                  isArchived ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {session.status || 'ACTIVE'}
                </span>
              </div>
            </div>
          </div>

          <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Session actions"
              aria-expanded={showMenu}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-36 z-30 rounded-xl bg-slate-950 border border-slate-800 py-1 shadow-2xl text-xs">
                  {isArchived ? (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onRestore(session.sessionId);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                      Restore
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onArchive(session.sessionId);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      <Archive className="w-3.5 h-3.5 text-amber-400" />
                      Archive
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(session.sessionId);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-950/40 hover:text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
            )}
          </div>
        </div>

        {session.description && (
          <p className="mt-3 text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {session.description}
          </p>
        )}
      </div>

      <div className="mt-5 pt-3.5 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            {session.documentCount || 0} Docs
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            {formatRelativeTime(session.updatedAt || session.createdAt)}
          </span>
        </div>
        <div className="text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition flex items-center gap-1 font-medium">
          Open <ArrowUpRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}
