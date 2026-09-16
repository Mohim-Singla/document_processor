import React, { useState, useEffect } from 'react';
import { Plus, Search, Archive, CheckCircle, FolderOpen, RefreshCw, AlertCircle, LogOut, User } from 'lucide-react';
import SessionCard from '../components/dashboard/SessionCard';
import CreateSessionModal from '../components/dashboard/CreateSessionModal';
import ConfirmModal from '../components/common/ConfirmModal';
import ErrorView from '../components/common/ErrorView';
import { showBackendError } from '../components/SnackbarContainer';
import { getSessions, createSession, updateSession, deleteSession, getUser } from '../services/api';

export default function DashboardPage({ onSelectSession, onLogout }) {
  const getInitialFilter = () => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab') || params.get('status') || params.get('filter');
    if (urlTab) {
      return urlTab.toUpperCase() === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
    }
    const savedFilter = localStorage.getItem('dashboardSessionFilter');
    if (savedFilter) {
      return savedFilter.toUpperCase() === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
    }
    return 'ACTIVE';
  };

  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState(getInitialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  // Confirmation modal state
  const [deleteTargetSessionId, setDeleteTargetSessionId] = useState(null);
  const currentUser = getUser();

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    localStorage.setItem('dashboardSessionFilter', newFilter);
    const url = new URL(window.location);
    if (newFilter === 'ARCHIVED') {
      url.searchParams.set('tab', 'ARCHIVED');
    } else {
      url.searchParams.delete('tab');
    }
    window.history.replaceState({}, '', url);
  };

  const loadInitialSessions = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getSessions({
        status: filter,
        cursor: null,
        limit: 12,
        search: searchQuery,
      });
      const data = res.response || res.data || {};
      if (Array.isArray(data)) {
        setSessions(data);
        setNextCursor(null);
        setHasMore(false);
      } else {
        setSessions(data.sessions || []);
        setNextCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
      }
    } catch (err) {
      console.error('Failed to load sessions from backend:', err);
      setError(err.message || 'Failed to connect to backend.');
      setSessions([]);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreSessions = async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    try {
      setLoadingMore(true);
      const res = await getSessions({
        status: filter,
        cursor: nextCursor,
        limit: 12,
        search: searchQuery,
      });
      const data = res.response || res.data || {};
      const newSessions = data.sessions || [];
      setSessions((prev) => [...prev, ...newSessions]);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      console.error('Failed to load more sessions:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Debounced search / filter reload
  useEffect(() => {
    localStorage.setItem('dashboardSessionFilter', filter);
    const url = new URL(window.location);
    if (filter === 'ARCHIVED') {
      url.searchParams.set('tab', 'ARCHIVED');
    } else {
      url.searchParams.delete('tab');
    }
    window.history.replaceState({}, '', url);

    const handler = setTimeout(() => {
      loadInitialSessions();
    }, 250);

    return () => clearTimeout(handler);
  }, [filter, searchQuery]);

  // Infinite scroll intersection observer
  useEffect(() => {
    if (!hasMore || loadingMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreSessions();
        }
      },
      { root: null, rootMargin: '200px', threshold: 0.1 }
    );

    const sentinel = document.getElementById('infinite-scroll-sentinel');
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, nextCursor, filter, searchQuery]);

  const handleCreate = async (data) => {
    try {
      const res = await createSession(data);
      const newSession = res.response || res.data;
      if (newSession) {
        setSessions((prev) => [newSession, ...prev]);
        onSelectSession(newSession);
      }
    } catch (err) {
      showBackendError(`Error creating session: ${err.message}`);
      throw err;
    }
  };

  const handleArchive = async (sessionId) => {
    try {
      await updateSession(sessionId, { status: 'ARCHIVED' });
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } catch (err) {
      showBackendError(`Failed to archive session: ${err.message}`);
    }
  };

  const handleRestore = async (sessionId) => {
    try {
      await updateSession(sessionId, { status: 'ACTIVE' });
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } catch (err) {
      showBackendError(`Failed to restore session: ${err.message}`);
    }
  };

  const confirmDeleteSession = async () => {
    if (!deleteTargetSessionId) return;
    try {
      await deleteSession(deleteTargetSessionId);
      setSessions((prev) => prev.filter((s) => s.sessionId !== deleteTargetSessionId));
    } catch (err) {
      showBackendError(`Failed to delete session: ${err.message}`);
    } finally {
      setDeleteTargetSessionId(null);
    }
  };

  const filteredSessions = sessions;

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

        <div className="flex items-center gap-3">
          {currentUser && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-medium">{currentUser.name || currentUser.email}</span>
            </div>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition"
          >
            <Plus className="w-4 h-4" />
            Create New Session
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-red-400 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
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
            onClick={() => handleFilterChange('ACTIVE')}
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
            onClick={() => handleFilterChange('ARCHIVED')}
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
        ) : error && sessions.length === 0 ? (
          <ErrorView
            compact={true}
            title="Unable to Load Sessions"
            subtitle={error}
            error={error}
            onRetry={loadInitialSessions}
          />
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
          <>
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

            {/* Infinite scroll trigger sentinel */}
            <div id="infinite-scroll-sentinel" className="h-4 w-full" />

            {/* Circular loader for pagination */}
            {loadingMore && (
              <div className="flex flex-col items-center justify-center py-6">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-400 mb-1" />
                <span className="text-[11px] text-slate-400 font-medium">Loading more sessions...</span>
              </div>
            )}
          </>
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
        message="Are you sure you want to delete this session? This will perform a soft delete on the session and its documents, removing them from your view while preserving stored file assets."
        confirmText="Delete Session"
        cancelText="Keep Session"
        isDestructive={true}
        onConfirm={confirmDeleteSession}
        onClose={() => setDeleteTargetSessionId(null)}
      />
    </div>
  );
}
