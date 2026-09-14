# Frontend Technical Requirements Document (FE TRD)
## Document Intelligence & Query System

---

## 1. Overview & Objectives

The Frontend application serves as the user-facing interface for the **Document Intelligence & Query System**. It empowers users to:
1. Manage research and extraction workspaces (**Sessions**): create, archive, restore, and delete sessions with an in-app confirmation modal.
2. Ingest documents into sessions via intuitive drag-and-drop file upload supporting PDF, DOCX, TXT, and scanned image formats.
3. Monitor document processing stages in real-time (uploading, parsing, embedding generation, ready).
4. Perform hybrid search and conversational question-answering powered by **Google Gemini API** (`gemini-3.6-flash`), with pinpoint source citations, passage inspection, and original document preview.

---

## 2. Technology Stack & Architectural Decisions

| Layer / Concern | Technology | Justification |
| :--- | :--- | :--- |
| **Build Tool & Bundler** | **Vite** (`v8.x`) | Instant server start, fast Hot Module Replacement (HMR), minimal boilerplate. |
| **UI Library** | **React 19** | Component-driven architecture, broad ecosystem, standard hook patterns. |
| **Styling & Design System** | **Tailwind CSS (`v4.x`)** via `@tailwindcss/vite` | Modern utility-first styling with dark-mode palette (`slate-950`). |
| **Icons** | **lucide-react** | Clean, lightweight SVG icon suite. |
| **Dialogs & Confirmations** | **Custom In-App `ConfirmModal`** | Replaces jarring browser alerts with styled destructive confirmation modals. |
| **HTTP & Streaming Client** | Native `fetch` with `ReadableStream` | Clean native stream consumption for Server-Sent Events (SSE) token streaming. |
| **File Upload UX** | **react-dropzone** | Drag & drop, MIME-type validation, multi-file queuing, and size limits (25MB). |
| **Markdown & Code Rendering** | **react-markdown** + **remark-gfm** | Rich rendering of AI responses including tables, bold headers, code snippets, and lists. |

---

## 3. Directory Structure (`frontend/`)

```
frontend/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── components/
│   │   ├── common/
│   │   │   └── ConfirmModal.jsx        # In-app confirmation dialog
│   │   ├── dashboard/
│   │   │   ├── SessionCard.jsx         # Card with status badge, doc count, and action menu
│   │   │   └── CreateSessionModal.jsx  # Modal for new session creation
│   │   └── workspace/
│   │       ├── DocumentDropzone.jsx    # Drag-and-drop file uploader
│   │       ├── DocumentListItem.jsx    # Status badges (Queued, Processing, Ready, Failed)
│   │       ├── ChatInterface.jsx       # Chat stream viewer with citation chips
│   │       └── CitationDrawer.jsx      # Slide-over snippet viewer with S3 preview link
│   ├── pages/
│   │   ├── DashboardPage.jsx           # Sessions listing, tabs, search, delete modal
│   │   └── SessionWorkspacePage.jsx    # Documents sidebar + Chat + Citation drawer
│   ├── services/
│   │   └── api.js                      # REST API client and streamQuery SSE reader
│   └── utils/
│       └── formatters.js               # File size and relative date formatters
```

---

## 4. UI Layout & Component Specifications

### 4.1. Screen 1: Dashboard (Homepage)
- **Top Bar**: Application title, "+ Create New Session" primary CTA.
- **Filter Tabs**: Toggle between `Active Sessions` and `Archived Sessions`.
- **Search**: Instant filtering of session cards by title and description.
- **Session Card**:
  - Session title and description.
  - Active/Archived pill badge.
  - Document counter and relative last-modified timestamp.
  - Context menu (`...`): Archive/Restore, Delete.
- **Delete Confirmation (`ConfirmModal`)**:
  - Custom dark dialog warning that session deletion permanently deletes all uploaded documents and vectors.

### 4.2. Screen 2: Session Workspace
- **Top Bar**: Back button, session title, status badge, Gemini model badge.
- **Left Panel (Documents Sidebar)**:
  - Drag-and-drop dropzone supporting PDF, DOCX, TXT, PNG, JPG (up to 25MB).
  - Document items showing filename, file size, page count, and real-time status:
    - `Queued` (gray)
    - `Processing` (indigo pulsing spinner)
    - `Ready` (emerald check)
    - `Error` (red warning)
  - Action buttons: Preview original (opens S3 presigned URL) and Delete (triggers `ConfirmModal`).
  - Auto-polling: Automatically polls `/v1/sessions/:id/documents` every 3 seconds while documents are in `PROCESSING` or `QUEUED` state.
- **Main Panel (Chat Workspace)**:
  - Chat thread history with distinct User vs Assistant bubble styling.
  - Typewriter token streaming animation during active Gemini query.
  - Markdown rendering (bold text, bulleted lists, tables).
  - Clickable citation chips: `[1] filename.pdf (p. 3)`.
  - Prompt input box with send button and Enter-key submission.
- **Slide-Over Citation Drawer**:
  - Opens on citation chip click.
  - Displays document name, exact page number, and the full extracted text chunk snippet.
  - "Open Original File (S3)" button.

---

## 5. Streaming & Communication Protocol (Google Gemini)

### 5.1. Streaming Flow
1. User submits question in `ChatInterface`.
2. Frontend calls `streamQuery(sessionId, prompt, handlers)` in `services/api.js`.
3. Backend handles SSE request:
   - Queries MongoDB for relevant session chunks using cosine similarity.
   - Streams Gemini answer tokens: `data: {"type":"token","content":"..."}`.
   - Emits structured citation metadata: `data: {"type":"citations","citations":[...]}`.
   - Terminates stream: `data: [DONE]`.
4. `ReadableStreamDefaultReader` parses lines on the fly, rendering text token-by-token and attaching citation chips upon stream completion.

---

## 6. Build & Proxy Configuration (`vite.config.js`)

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```
