# Document Intelligence Platform (`document_processor`)

A production-grade, multi-tenant document processing and conversational RAG (Retrieval-Augmented Generation) platform. It features asynchronous document ingestion via AWS SQS, OCR extraction, high-level document summarization, contextual vector embeddings via Google Gemini, and real-time streaming answers with inline citations.

---

## Architecture Overview

* **Monorepo Structure**:
  * `backend/`: Node.js / Express.js ESM REST API & asynchronous background worker (`worker.js`).
  * `frontend/`: React 19 / Vite / Tailwind CSS single-page workspace application.
* **Datastore**: MongoDB (via Mongoose ODM) for users, sessions, documents, document chunks, and chat messages.
* **AI & Embeddings**: Multi-Provider Orchestrator with automated failover across Google Gemini, Groq, and OpenAI (`gemini-3.5-flash` / `gemini-embedding-2` for 768-dimensional vector embeddings, Groq for fast LLM inference, and OpenAI as optional fallback).
* **Storage & Queueing**: AWS S3 for raw document storage; AWS SQS for asynchronous worker ingestion with automated in-process fallback.

---

## Prerequisites

Before setting up the project locally, ensure you have the following installed:

1. **Node.js**: `v20.x` or higher
2. **npm**: `v10.x` or higher
3. **MongoDB**: A running local instance (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas connection string.
4. **AI Provider API Key**: At least one API key from [Google AI Studio](https://aistudio.google.com/), [Groq Cloud](https://console.groq.com/), or [OpenAI](https://platform.openai.com/).
5. **AWS S3 & SQS (Optional for local dev)**: S3 bucket and credentials. If SQS is not configured, the backend automatically runs in **in-process fallback mode**.

---

## Local Setup & Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd document_processor
```

### 2. Install Dependencies

The repository uses npm workspaces. Install all root, backend, and frontend dependencies with a single command from the root directory:

```bash
npm install
```

---

### 3. Configure Environment Variables

#### Backend Configuration (`backend/.env`)

Copy `backend/.env.example` to create your local `.env`:

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and supply your actual keys/credentials. Refer directly to [`backend/.env.example`](backend/.env.example) for the full list of required settings (MongoDB, AWS, JWT, and AI keys) and customizable `#optional` overrides (such as `AI_PROVIDER_ORDER`, model candidate names, and file upload limits).

> **Note on Local Development Without AWS**:
> If AWS SQS is not configured, the application automatically runs in **in-process fallback mode** (executing parsing, OCR, and embedding via the local event loop).

---

#### Frontend Configuration (`frontend/.env`)

Copy `frontend/.env.example` to create your local `.env`:

```bash
cp frontend/.env.example frontend/.env
```

Refer to [`frontend/.env.example`](frontend/.env.example) to configure the API base URL (defaults to `http://localhost:8000`).

---

## Running the Application Locally

You can run the entire system using the root workspace scripts:

### Option A: Run Everything Concurrently (Recommended)

Starts the Backend REST API, the SQS Background Worker, and the Vite Frontend in a single terminal with colored logs:

```bash
npm run dev:all
```

* **Frontend UI**: [http://localhost:5173](http://localhost:5173)
* **Backend API**: [http://localhost:8000](http://localhost:8000)
* **API Health Check**: [http://localhost:8000/ping](http://localhost:8000/ping)

---

### Option B: Run Services Individually

If you prefer separate terminal windows:

1. **Start Backend API**:
   ```bash
   npm run dev:backend
   ```
2. **Start Background Ingestion Worker**:
   ```bash
   npm run dev:worker
   ```
3. **Start Frontend Client**:
   ```bash
   npm run dev:frontend
   ```

---

## Common Development Commands

| Command | Description |
| :--- | :--- |
| `npm run dev:all` | Runs Backend, Worker, and Frontend concurrently. |
| `npm run dev:services` | Runs Backend API and Background Worker concurrently. |
| `npm run dev:backend` | Starts Backend with `nodemon` live reload. |
| `npm run dev:worker` | Starts Ingestion Worker with `nodemon` live reload. |
| `npm run dev:frontend` | Starts Vite development server for React UI. |
| `npm run build:frontend` | Compiles and builds production assets for Frontend. |
| `npm run lint:fix --workspace=backend` | Runs ESLint and auto-fixes issues across the backend. |

---

## Testing & Verifying Setup

1. Open [http://localhost:5173](http://localhost:5173) in your browser.
2. Sign up with an email and password to create a local user account.
3. Create a new document session/workspace.
4. Drag and drop a sample PDF or text document.
5. Once the document status updates to **READY**, ask natural language questions in the chat interface. Verify real-time streaming tokens and citation drawer chips.