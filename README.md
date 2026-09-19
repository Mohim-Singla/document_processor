# Document Intelligence Platform (`document_processor`)

A production-grade, multi-tenant document processing and conversational RAG (Retrieval-Augmented Generation) platform. It features asynchronous document ingestion via AWS SQS, OCR extraction, high-level document summarization, contextual vector embeddings via Google Gemini, and real-time streaming answers with inline citations.

---

## Architecture Overview

* **Monorepo Structure**:
  * `backend/`: Node.js / Express.js ESM REST API & asynchronous background worker (`worker.js`).
  * `frontend/`: React 19 / Vite / Tailwind CSS single-page workspace application.
* **Datastore**: MongoDB (via Mongoose ODM) for users, sessions, documents, document chunks, and chat messages.
* **AI & Embeddings**: Google Gemini API (`gemini-3.5-flash` for conversational completions, `gemini-embedding-001` for 768-dimensional contextual vector embeddings).
* **Storage & Queueing**: AWS S3 for raw document storage; AWS SQS for asynchronous worker ingestion with automated in-process fallback.

---

## Prerequisites

Before setting up the project locally, ensure you have the following installed:

1. **Node.js**: `v20.x` or higher
2. **npm**: `v10.x` or higher
3. **MongoDB**: A running local instance (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas connection string.
4. **Google Gemini API Key**: API key from [Google AI Studio](https://aistudio.google.com/).
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

Create a `.env` file in the `backend/` directory based on `backend/.env.example`:

```bash
cp backend/.env.example backend/.env
```

Populate the required configuration values in `backend/.env`:

```env
# Application Environment
ENV=development
PORT=8000

# MongoDB Configuration
MONGO_HOST_IP=127.0.0.1:27017
MONGO_DATABASE=document_processor
MONGO_USER=
MONGO_PASSWORD=
MONGO_SRV_FLAG=false

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# Google Gemini API
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
GEMINI_LLM_MODEL=gemini-3.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

# AWS Configuration (S3 & SQS)
AWS_REGION=ap-south-1
AWS_ACCOUNT_ID=123456789012
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET_NAME=your-document-storage-bucket
AWS_SQS_REGION_DEFAULT=ap-south-1
```

> **Note on Local Development Without SQS**:
> If AWS SQS is unavailable, the application gracefully catches queue failures and executes document parsing, OCR, and embedding in the background event loop via `setImmediate`.

---

#### Frontend Configuration (`frontend/.env`)

Create a `.env` file in the `frontend/` directory based on `frontend/.env.example`:

```bash
cp frontend/.env.example frontend/.env
```

Configure the API base URL:

```env
VITE_API_BASE_URL=http://localhost:8000/v1
```

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