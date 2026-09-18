import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import DocumentDropzone from '../components/workspace/DocumentDropzone';
import DocumentListItem from '../components/workspace/DocumentListItem';
import ChatInterface from '../components/workspace/ChatInterface';
import CitationDrawer from '../components/workspace/CitationDrawer';
import ConfirmModal from '../components/common/ConfirmModal';
import DocumentPreviewModal from '../components/workspace/DocumentPreviewModal';
import ErrorView from '../components/common/ErrorView';
import { showBackendError } from '../components/SnackbarContainer';
import {
  getSessionDocuments,
  uploadDocuments,
  getDocumentPreviewUrl,
  retryDocument,
  deleteDocument,
  getSessionMessages,
  streamQuery,
  updateSession,
} from '../services/api';

export default function SessionWorkspacePage({ session, onBack, onSessionUpdate }) {
  const isArchived = session?.status === 'ARCHIVED';
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamText, setCurrentStreamText] = useState('');
  const [selectedCitation, setSelectedCitation] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Document preview modal state
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Confirmation modal state for document deletion
  const [deleteTargetDocId, setDeleteTargetDocId] = useState(null);

  const loadSessionData = async () => {
    try {
      setLoading(true);
      setError('');
      const [docRes, msgRes] = await Promise.all([
        getSessionDocuments(session.sessionId).catch(() => ({ response: [] })),
        getSessionMessages(session.sessionId).catch(() => ({ response: [] })),
      ]);

      const docList = docRes.response || docRes.data || (Array.isArray(docRes) ? docRes : []);
      setDocuments(docList);

      const msgList = msgRes.response || msgRes.data || (Array.isArray(msgRes) ? msgRes : []);
      setMessages(msgList);
    } catch (err) {
      console.error('Failed to load session details:', err);
      setError(err.message || 'Failed to fetch session documents and history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionData();
  }, [session.sessionId]);

  // Status polling when documents are processing or queued
  useEffect(() => {
    const hasPending = documents.some(
      (d) => d.status === 'PROCESSING' || d.status === 'QUEUED'
    );
    if (!hasPending) return;

    const interval = setInterval(async () => {
      try {
        const res = await getSessionDocuments(session.sessionId);
        const updated = res.response || res.data || [];
        setDocuments(updated);
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, session.sessionId]);

  const handleUpload = async (files) => {
    setIsUploading(true);
    try {
      const res = await uploadDocuments(session.sessionId, files);
      const newlyCreated = res.response || res.data || [];
      setDocuments((prev) => [...newlyCreated, ...prev]);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const confirmDeleteDoc = async () => {
    if (!deleteTargetDocId) return;
    try {
      await deleteDocument(session.sessionId, deleteTargetDocId);
      setDocuments((prev) => prev.filter((d) => d.documentId !== deleteTargetDocId));
    } catch (err) {
      showBackendError(`Failed to delete document: ${err.message}`);
    } finally {
      setDeleteTargetDocId(null);
    }
  };

  const handlePreviewDoc = async (doc) => {
    setPreviewDoc(doc);
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const res = await getDocumentPreviewUrl(session.sessionId, doc.documentId);
      const data = res.response || res.data || res;
      if (data?.url) {
        setPreviewData(data);
      } else {
        showBackendError('No preview URL available for this document.');
        setPreviewDoc(null);
      }
    } catch (err) {
      showBackendError(`Failed to get preview URL: ${err.message}`);
      setPreviewDoc(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewDoc(null);
    setPreviewData(null);
    setPreviewLoading(false);
  };

  const handleRetryDoc = async (docId) => {
    try {
      setDocuments((prev) =>
        prev.map((d) =>
          d.documentId === docId ? { ...d, status: 'PROCESSING', errorMessage: null } : d
        )
      );
      await retryDocument(session.sessionId, docId);
    } catch (err) {
      console.error('Failed to retry document:', err);
      loadSessionData();
    }
  };

  const handleSendMessage = async (prompt, { isRetry = false } = {}) => {
    if (!isRetry) {
      const userMsg = { sender: 'USER', content: prompt, citations: [] };
      setMessages((prev) => [...prev, userMsg]);
    }
    setIsStreaming(true);
    setCurrentStreamText('');

    let accumulatedText = '';
    let citationsCollected = [];

    try {
      await streamQuery(session.sessionId, prompt, {
        onToken: (token) => {
          accumulatedText += token;
          setCurrentStreamText(accumulatedText);
        },
        onCitations: (citations) => {
          citationsCollected = citations;
        },
        onError: (err) => {
          console.error('Stream error:', err);
          setIsStreaming(false);
          setCurrentStreamText('');
        },
        onComplete: () => {
          setMessages((prev) => [
            ...prev,
            {
              sender: 'ASSISTANT',
              content: accumulatedText,
              citations: citationsCollected,
            },
          ]);
          setIsStreaming(false);
          setCurrentStreamText('');
        },
      });
    } catch (err) {
      console.error('Query failed:', err);
      setIsStreaming(false);
      setCurrentStreamText('');
    }
  };

  const handleRetryLast = (prompt) => {
    handleSendMessage(prompt, { isRetry: true });
  };

  const handleSelectCitation = (citation) => {
    setSelectedCitation(citation);
    setIsDrawerOpen(true);
  };

  const handleRestore = useCallback(async () => {
    try {
      const res = await updateSession(session.sessionId, { status: 'ACTIVE' });
      const updated = res.response || res.data;
      if (updated && onSessionUpdate) {
        onSessionUpdate(updated);
      }
    } catch (err) {
      showBackendError(`Failed to restore session: ${err.message}`);
    }
  }, [session.sessionId, onSessionUpdate]);

  if (!session) {
    return (
      <ErrorView
        title="Session Not Found"
        subtitle="The requested document session could not be found or has been removed."
        errorCode="404"
        onGoHome={onBack}
      />
    );
  }

  if (error && documents.length === 0 && messages.length === 0) {
    return (
      <ErrorView
        title="Unable to Load Workspace"
        subtitle={error}
        error={error}
        onRetry={loadSessionData}
        onGoHome={onBack}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950">
      {/* Top Navigation */}
      <header className="h-16 border-b border-slate-800/80 px-6 flex items-center justify-between bg-slate-900/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Sessions</span>
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              {session.title}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isArchived ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'}`}>
                {session.status || 'ACTIVE'}
              </span>
            </h2>
            {session.description && (
              <p className="text-[11px] text-slate-400 truncate max-w-md">{session.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Google Gemini Pro</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Documents Sidebar */}
        <aside className="w-84 xl:w-92 border-r border-slate-800/80 p-5 flex flex-col justify-between bg-slate-900/30 overflow-y-auto shrink-0">
          <div className="space-y-5">
            {!isArchived && (
              <div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                  Upload Documents
                </h3>
                <DocumentDropzone onUpload={handleUpload} isUploading={isUploading} />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Session Documents ({documents.length})
                </h3>
              </div>
              <div className="space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center py-6 text-slate-500 gap-2 text-xs">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Loading documents...</span>
                  </div>
                ) : documents.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No documents uploaded yet.
                  </p>
                ) : (
                  documents.map((doc) => (
                    <DocumentListItem
                      key={doc.documentId}
                      doc={doc}
                      onPreview={() => handlePreviewDoc(doc)}
                      onDelete={(docId) => setDeleteTargetDocId(docId)}
                      onRetry={isArchived ? null : handleRetryDoc}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Center / Right Chat Workspace */}
        <main className="flex-1 p-6 overflow-hidden">
          <ChatInterface
            messages={messages}
            onSendMessage={isArchived ? null : handleSendMessage}
            onRetry={isArchived ? null : handleRetryLast}
            isStreaming={isStreaming}
            currentStreamText={currentStreamText}
            onSelectCitation={handleSelectCitation}
            isArchived={isArchived}
            onRestore={handleRestore}
          />
        </main>
      </div>

      {/* Citation Slide-over Drawer */}
      <CitationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        citation={selectedCitation}
        onPreviewOriginal={(docId) => {
          setIsDrawerOpen(false);
          const doc = documents.find((d) => d.documentId === docId);
          if (doc) {
            handlePreviewDoc(doc);
          }
        }}
      />

      {/* In-Session Universal Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        onClose={handleClosePreview}
        doc={previewDoc}
        sessionId={session.sessionId}
        previewData={previewData}
        loading={previewLoading}
      />

      {/* UI Integrated Confirmation Modal for Document Deletion */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetDocId)}
        title="Delete Document"
        message="Are you sure you want to delete this document? This will soft delete the document and exclude it from vector search queries while preserving the underlying file."
        confirmText="Delete Document"
        cancelText="Keep Document"
        isDestructive={true}
        onConfirm={confirmDeleteDoc}
        onClose={() => setDeleteTargetDocId(null)}
      />
    </div>
  );
}
