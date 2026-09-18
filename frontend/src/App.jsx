import React, { useState, useEffect } from 'react';
import DashboardPage from './pages/DashboardPage';
import SessionWorkspacePage from './pages/SessionWorkspacePage';
import LoginPage from './pages/LoginPage';
import SnackbarContainer from './components/SnackbarContainer';
import { getAuthToken, getUser, logout, getSessionById } from './services/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Helper to extract session ID from URL path or query (?session=ID or /session/ID)
  const getSessionIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const querySessionId = params.get('session');
    if (querySessionId) return querySessionId;

    const match = window.location.pathname.match(/\/session\/([^/]+)/);
    if (match && match[1]) return match[1];

    return localStorage.getItem('activeSessionId');
  };

  useEffect(() => {
    const initApp = async () => {
      const token = getAuthToken();
      const storedUser = getUser();

      if (token && storedUser) {
        setUser(storedUser);

        // Check if there was an active session to restore
        const targetSessionId = getSessionIdFromUrl();
        if (targetSessionId) {
          try {
            const res = await getSessionById(targetSessionId);
            const session = res.response || res.data;
            if (session) {
              setActiveSession(session);
              // Ensure URL reflects current session state
              const newUrl = new URL(window.location);
              newUrl.searchParams.set('session', session.sessionId);
              window.history.replaceState({}, '', newUrl);
            }
          } catch (err) {
            console.warn('Could not restore session on reload:', err.message);
            localStorage.removeItem('activeSessionId');
            const cleanUrl = new URL(window.location);
            cleanUrl.searchParams.delete('session');
            window.history.replaceState({}, '', cleanUrl);
          }
        }
      } else {
        logout();
        setUser(null);
        setActiveSession(null);
        localStorage.removeItem('activeSessionId');
        window.history.replaceState({}, '', '/login');
      }

      setInitializing(false);
    };

    initApp();

    // Listen for unauthorized 401 events
    const handleUnauthorized = () => {
      setUser(null);
      setActiveSession(null);
      localStorage.removeItem('activeSessionId');
      window.history.replaceState({}, '', '/login');
    };

    // Handle browser back/forward buttons
    const handlePopState = async () => {
      if (window.location.pathname === '/login') {
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const targetSessionId = params.get('session');
      if (!targetSessionId) {
        setActiveSession(null);
        localStorage.removeItem('activeSessionId');
      } else {
        localStorage.setItem('activeSessionId', targetSessionId);
        try {
          const res = await getSessionById(targetSessionId);
          const session = res.response || res.data;
          if (session) {
            setActiveSession(session);
          }
        } catch (err) {
          console.warn('Could not load session from history forward/backward:', err.message);
          setActiveSession(null);
          localStorage.removeItem('activeSessionId');
        }
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleSelectSession = (session) => {
    setActiveSession(session);
    if (session?.sessionId) {
      localStorage.setItem('activeSessionId', session.sessionId);
      const newUrl = new URL(window.location);
      newUrl.pathname = '/';
      newUrl.searchParams.set('session', session.sessionId);
      window.history.pushState({}, '', newUrl);
    }
  };

  const handleBackToDashboard = () => {
    setActiveSession(null);
    localStorage.removeItem('activeSessionId');
    const newUrl = new URL(window.location);
    newUrl.pathname = '/';
    newUrl.searchParams.delete('session');
    const savedFilter = localStorage.getItem('dashboardSessionFilter');
    if (savedFilter === 'ARCHIVED') {
      newUrl.searchParams.set('tab', 'ARCHIVED');
    }
    window.history.pushState({}, '', newUrl);
  };

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    window.history.replaceState({}, '', '/');
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setActiveSession(null);
    localStorage.removeItem('activeSessionId');
    window.history.replaceState({}, '', '/login');
  };

  const handleSessionUpdate = (updatedSession) => {
    setActiveSession(updatedSession);
  };

  return (
    <>
      <SnackbarContainer />
      {initializing ? (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
          Loading Document Intelligence...
        </div>
      ) : !user ? (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      ) : (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
          {activeSession ? (
            <SessionWorkspacePage
              session={activeSession}
              onBack={handleBackToDashboard}
              onSessionUpdate={handleSessionUpdate}
            />
          ) : (
            <DashboardPage
              onSelectSession={handleSelectSession}
              onLogout={handleLogout}
            />
          )}
        </div>
      )}
    </>
  );
}
