import React, { useState, useEffect } from 'react';
import { Plus, Search, Archive, CheckCircle, FolderOpen, RefreshCw, AlertCircle } from 'lucide-react';
import SessionCard from '../components/dashboard/SessionCard';
import CreateSessionModal from '../components/dashboard/CreateSessionModal';
import ConfirmModal from '../components/common/ConfirmModal';
import { getSessions, createSession, updateSession, deleteSession } from '../services/api';

export default function DashboardPage({ onSelectSession }) {
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTargetSessionId, setDeleteTargetSessionId] = useState(null);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getSessions(filter);
      const list = res.response || res.data || (Array.isArray(res) ? res : []);
      setSessions(list);
    } catch (err) {
      console.error('Failed to load sessions from backend:', err);
      setError(err.message || 'Failed to connect to backend.');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [filter]);

  const handleCreate = async (data) => {
    try {
      const res = await createSession(data);
      const newSession = res.response || res.data;
      if (newSession) {
        setSessions((prev) => [newSession, ...prev]);
        onSelectSession(newSession);
      }
    } catch (err) {
      alert(`Error creating session: ${err.message}`);
      throw err;
    }
  };

  const handleArchive = async (sessionId) => {
    try {
      await updateSession(sessionId, { status: 'ARCHIVED' });
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } catch (err) {
      alert(`Failed to archive session: ${err.message}`);
    }
  };

  const handleRestore = async (sessionId) => {
    try {
      await updateSession(sessionId, { status: 'ACTIVE' });
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } catch (err) {
      alert(`Failed to restore session: ${err.message}`);
    }
  };

  const confirmDeleteSession = async () => {
    if (!deleteTargetSessionId) return;
    try {
      await deleteSession(deleteTargetSessionId);
      setSessions((prev) => prev.filter((s) => s.sessionId !== deleteTargetSessionId));
    } catch (err) {
      alert(`Failed to delete session: ${err.message}`);
    } finally {
      setDeleteTargetSessionId(null);
    }
  };

  const filteredSessions = sessions.filter((s) =>
    s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-8 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Workspaces & Sessions</h1>
          <p className="text-xs text-slate-400 mt-1">
            Turn unstructured documents into clean, searchable, and queryable intelligence.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition"
        >
          <Plus className="w-4 h-4" />
          Create New Session
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-950/40 border border-red-900/60 flex items-center justify-between text-xs text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadSessions}
            className="px-2.5 py-1 rounded-lg bg-red-900/50 hover:bg-red-900 text-red-200 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-6">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl self-start">
          <button
            onClick={() => setFilter('ACTIVE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === 'ACTIVE'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Active Sessions
          </button>
          <button
            onClick={() => setFilter('ARCHIVED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === 'ARCHIVED'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            Archived
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      </div>

      {/* Sessions Grid */}
      <div className="mt-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400 mb-2" />
            <span className="text-xs">Loading sessions from backend...</span>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
            <div className="p-4 rounded-2xl bg-slate-900 text-slate-500 mb-3">
              <FolderOpen className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-semibold text-slate-300">No {filter.toLowerCase()} sessions found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {searchQuery
                ? 'No sessions match your search criteria.'
                : 'Create your first session to start uploading and querying documents.'}
            </p>
            {!searchQuery && filter === 'ACTIVE' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
              >
                Create Session
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.sessionId}
                session={session}
                onSelect={onSelectSession}
                onArchive={handleArchive}
                onRestore={handleRestore}
                onDelete={(id) => setDeleteTargetSessionId(id)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateSessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreate}
      />

      {/* UI Integrated Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetSessionId)}
        title="Delete Session"
        message="Are you sure you want to permanently delete this session and all its uploaded documents? This action cannot be undone."
        confirmText="Delete Session"
        cancelText="Keep Session"
        isDestructive={true}
        onConfirm={confirmDeleteSession}
        onClose={() => setDeleteTargetSessionId(null)}
      />
    </div>
  );
}
