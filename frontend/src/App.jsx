import React, { useState } from 'react';
import DashboardPage from './pages/DashboardPage';
import SessionWorkspacePage from './pages/SessionWorkspacePage';

export default function App() {
  const [activeSession, setActiveSession] = useState(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {activeSession ? (
        <SessionWorkspacePage
          session={activeSession}
          onBack={() => setActiveSession(null)}
        />
      ) : (
        <DashboardPage onSelectSession={(session) => setActiveSession(session)} />
      )}
    </div>
  );
}
