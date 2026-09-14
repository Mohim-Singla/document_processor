# Backend Technical Requirements Document (BE TRD)
## Document Intelligence & Query System

---

## 1. Executive Summary & System Scope

The Backend of the **Document Intelligence & Query System** is an asynchronous, dual-persistence Node.js service (Express.js, ES Modules) responsible for:
1. **Workspace & Session Orchestration**: CRUD operations, archiving, and state management for user sessions in **MongoDB**.
2. **Secure Cloud File Ingestion**: Receiving multi-format documents (PDF, DOCX, TXT, images) and storing originals in **AWS S3** (`ap-south-1`).
3. **Document Extraction & Processing Pipeline**: Parsing native text via `pdf2json` (with safe UTF-8/URI decoding) and `mammoth` (DOCX), structural extraction (pages, sections), and chunking.
4. **Vector Embedding & Persistence**: Computing vector embeddings via **Google Gemini Embedding API** (`gemini-embedding-001`, 3072-dimensional) and storing high-dimensional vectors in **MongoDB**.
5. **RAG & Conversational Q&A**: Performing cosine semantic retrieval, context window assembly, and token-by-token streaming responses with source citations via **Google Gemini** (`gemini-3.6-flash`).
6. **User Account Persistence**: Maintaining core user accounts and credentials in **MySQL** (Sequelize).

---

## 2. Technical Stack & Core Dependencies

| Concern / Layer | Technology / Library | Role & Justification |
| :--- | :--- | :--- |
| **Runtime & Framework** | Node.js (ESM) + Express.js (`v4.21.1`) | High-concurrency event-driven API server |
| **Document, Session & Vector Store** | MongoDB + Mongoose (`v8.8.1`) | Sessions, documents metadata, semi-structured chunks, embeddings, and chat history with auto collection creation |
| **User Persistence** | MySQL 8.x + Sequelize ORM (`v6.37.5`) | Transactional persistence strictly for `users` |
| **Cloud File Storage** | AWS S3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) | Scalable, encrypted raw document object store (`ap-south-1`) |
| **File Upload Handling** | `multer` (memory storage) | Multipart form-data handling with MIME-type and size guards |
| **AI & LLM Services** | Google Gemini API (`@google/genai` v2) | Embedding generation (`gemini-embedding-001`) & streaming generation (`gemini-3.6-flash`) |
| **Document Parsers** | `pdf2json`, `mammoth` | Page-level PDF text extraction and DOCX parsing with safe URI decoding |
| **Validation & Security** | `joi`, `jsonwebtoken`, `bcryptjs`, `cors` | Schema validation and auth middleware |

---

## 3. Database Architecture & Schemas

```mermaid
erDiagram
    USERS ||--o{ SESSIONS : owns
    SESSIONS ||--o{ DOCUMENTS : contains
    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : splits_into
    SESSIONS ||--o{ CHAT_MESSAGES : records

    USERS {
        string userId PK "MySQL"
        string email
        string name
        string password
    }

    SESSIONS {
        string sessionId PK "MongoDB"
        string userId FK
        string title
        string description
        enum status "ACTIVE, ARCHIVED"
        int documentCount
        datetime createdAt
        datetime updatedAt
    }

    DOCUMENTS {
        string documentId PK "MongoDB"
        string sessionId FK
        string fileName
        string mimeType
        bigint fileSize
        string s3Key
        string s3Bucket
        enum status "QUEUED, PROCESSING, READY, FAILED"
        int pageCount
        string errorMessage
        datetime createdAt
        datetime updatedAt
    }

    DOCUMENT_CHUNKS {
        string chunkId PK "MongoDB"
        string documentId FK
        string sessionId FK
        int pageNumber
        int chunkIndex
        string content
        array embedding "Vector Float[3072]"
        object metadata
    }

    CHAT_MESSAGES {
        string messageId PK "MongoDB"
        string sessionId FK
        enum sender "USER, ASSISTANT"
        string content
        array citations
        datetime timestamp
    }
```

### 3.1. MySQL Schema (Sequelize)

#### `users`
- `userId`: `STRING(36)` (Primary Key)
- `name`: `STRING`
- `email`: `STRING` (Unique, Not Null)
- `password`: `STRING` (Hashed)
- `isEnabled`: `BOOLEAN` (Default: true)

---

### 3.2. MongoDB Schemas (Mongoose)

#### `sessions` Collection
```javascript
{
  sessionId: { type: String, required: true, unique: true },
  userId: { type: String, default: null, index: true },
  title: { type: String, required: true },
  description: { type: String, default: null },
  status: { type: String, enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE', index: true },
  documentCount: { type: Number, default: 0 }
}
```

#### `documents` Collection
```javascript
{
  documentId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  fileName: { type: String, required: true },
  mimeType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  s3Key: { type: String, required: true },
  s3Bucket: { type: String, required: true },
  status: { type: String, enum: ['QUEUED', 'PROCESSING', 'READY', 'FAILED'], default: 'QUEUED', index: true },
  pageCount: { type: Number, default: 0 },
  errorMessage: { type: String, default: null }
}
```

#### `document_chunks` Collection
```javascript
{
  chunkId: { type: String, required: true, unique: true },
  documentId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  pageNumber: { type: Number, default: 1 },
  chunkIndex: { type: Number, required: true },
  content: { type: String, required: true },
  metadata: {
    charLength: Number,
    fileName: String
  },
  embedding: { type: [Number], default: [] } // 3072 dimensions from gemini-embedding-001
}
```

#### `chat_messages` Collection
```javascript
{
  messageId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  sender: { type: String, enum: ['USER', 'ASSISTANT'], required: true },
  content: { type: String, required: true },
  citations: [
    {
      documentId: String,
      fileName: String,
      pageNumber: Number,
      snippet: String,
      score: Number
    }
  ],
  timestamp: { type: Date, default: Date.now }
}
```

---

## 4. Document Ingestion, S3 & Parsing Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Client as Frontend UI
    participant API as Express Router
    participant S3 as AWS S3
    participant DB_MGO as MongoDB
    participant Parser as Parsing Engine (pdf2json / mammoth)
    participant Gemini as Google Gemini API

    Client->>API: POST /v1/sessions/:id/documents (Multipart File)
    API->>S3: Upload raw buffer (sessions/:id/:docId/:filename)
    API->>DB_MGO: Insert record into `documents` (status = 'PROCESSING')
    API-->>Client: 202 Accepted { documentId, status: 'PROCESSING' }

    Note over API,Parser: Asynchronous Ingestion Job
    API->>Parser: Parse file (PDF page-by-page / DOCX)
    Parser->>Parser: Extract clean text & safe URI decode
    Parser->>Parser: Split into semantic chunks (~1200 chars, 200 overlap)
    
    loop For each chunk
        Parser->>Gemini: POST gemini-embedding-001
        Gemini-->>Parser: Vector embeddings [3072 dimensions]
    end

    Parser->>DB_MGO: Bulk insert `document_chunks` with embeddings
    Parser->>DB_MGO: Update document status = 'READY', pageCount = N
    Parser->>DB_MGO: Increment session documentCount
```

---

## 5. Google Gemini RAG & Streaming Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Client as Frontend UI
    participant API as Query Controller
    participant Gemini as Google Gemini API
    participant DB_MGO as MongoDB
    
    Client->>API: POST /v1/sessions/:id/query { prompt, stream: true }
    API->>Gemini: Generate prompt embedding (gemini-embedding-001)
    Gemini-->>API: Query vector [3072 dims]
    API->>DB_MGO: Find chunks by session & calculate Cosine Similarity
    DB_MGO-->>API: Top K most relevant chunks (K=5)
    
    API->>API: Formulate System Instruction & Context Excerpts
    Note over API: Direct model to cite sources: "[1] Page X"\nPass retrieved chunks with citation tokens
    
    API->>Gemini: Stream Chat Completion (gemini-3.6-flash)
    API-->>Client: HTTP 200 (Transfer-Encoding: chunked / SSE)
    
    loop Stream response chunks
        Gemini-->>API: Token chunks
        API-->>Client: data: {"type": "token", "content": "..."}
    end
    
    API-->>Client: data: {"type": "citations", "citations": [...]}
    API-->>Client: data: [DONE]
    
    API->>DB_MGO: Persist User question & Assistant answer with citations
```

---

## 6. REST API Specification

### 6.1. Sessions API
- `GET /v1/sessions`: List sessions for user. Query params: `status` (`ACTIVE` | `ARCHIVED`).
- `POST /v1/sessions`: Create new session. Body: `{ "title": "...", "description": "..." }`.
- `PATCH /v1/sessions/:id`: Update session title or status (`status: "ARCHIVED"` / `"ACTIVE"`).
- `DELETE /v1/sessions/:id`: Cascaded deletion of S3 objects, MongoDB session, documents, chunks, and chat history.

### 6.2. Documents API
- `POST /v1/sessions/:id/documents`: Multipart upload (`files[]`). Uploads to S3, registers in MongoDB, and triggers async parsing + embedding.
- `GET /v1/sessions/:id/documents`: List documents belonging to session.
- `GET /v1/sessions/:id/documents/:docId/preview`: Generate presigned AWS S3 `GetObject` URL for document preview.
- `DELETE /v1/sessions/:id/documents/:docId`: Remove document from MongoDB, delete S3 object, and clear associated chunks.

### 6.3. Conversational Query & Chat API
- `POST /v1/sessions/:id/query`: Ask question over session documents.
  - Body: `{ "prompt": "What are the liabilities?", "stream": true }`.
  - Response: Server-Sent Events (`text/event-stream`) streaming answer tokens followed by citation references.
- `GET /v1/sessions/:id/messages`: Retrieve chat message history.

---

## 7. Cloud & Configuration Variables (`.env`)

```ini
ENV=local
PORT=3000

# MongoDB Configuration
MONGO_HOST_IP=127.0.0.1:27017
MONGO_USER=root
MONGO_PASSWORD=password
MONGO_DATABASE=document_processor
MONGO_SRV_FLAG=false

# MySQL Configuration (strictly for users)
MYSQL_HOST_IP=127.0.0.1
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_DATABASE=document_processor

# Google Gemini API
GEMINI_API_KEY=AIzaSy...
GEMINI_LLM_MODEL=gemini-3.6-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

# AWS S3 Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=s3-document-processor
```
