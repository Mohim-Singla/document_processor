# Architectural Decisions Log (`DECISIONS.md`)

This document is a running log of the real architectural and engineering decisions made during the design, implementation, optimization, and deployment of the `document_processor` platform. 

It captures the actual calls made under ambiguity and time constraints, the alternatives considered, the tradeoffs accepted, and what was deliberately cut to maintain velocity and stability.

---

## Table of Contents

1. [Datastore Architecture: MongoDB as the Single Datastore](#1-datastore-architecture-mongodb-as-the-single-datastore)
2. [Ingestion Pipeline: Asynchronous AWS SQS Worker vs. Synchronous HTTP Ingestion](#2-ingestion-pipeline-asynchronous-aws-sqs-worker-vs-synchronous-http-ingestion)
3. [Vector Storage & Retrieval: In-Memory Cosine Similarity vs. Dedicated Vector Database](#3-vector-storage--retrieval-in-memory-cosine-similarity-vs-dedicated-vector-database)
4. [Embedding Pipeline: Chunk Batching and Concurrency Throttling](#4-embedding-pipeline-chunk-batching-and-concurrency-throttling)
5. [LLM Model Strategy: Model Fallback Cascade & Primary Model Selection](#5-llm-model-strategy-model-fallback-cascade--primary-model-selection)
6. [RAG Latency Optimization: Parallel Retrieval & Compound Indexing](#6-rag-latency-optimization-parallel-retrieval--compound-indexing)
7. [Security Architecture: Mandatory `userId` Scoping for IDOR Elimination](#7-security-architecture-mandatory-userid-scoping-for-idor-elimination)
8. [Deployment Architecture: Single-Container Bundle vs. Split Infrastructure](#8-deployment-architecture-single-container-bundle-vs-split-infrastructure)
9. [Build Strategy: Multi-Stage Linux Docker Build to Eliminate Native Binary Conflicts](#9-build-strategy-multi-stage-linux-docker-build-to-eliminate-native-binary-conflicts)
10. [CI/CD Pipeline: Manual GitHub Actions Workflow Dispatch with Environment Secrets](#10-cicd-pipeline-manual-github-actions-workflow-dispatch-with-environment-secrets)
11. [Pagination Strategy: Cursor-Based Pagination vs. Offset/Limit](#11-pagination-strategy-cursor-based-pagination-vs-offsetlimit)
12. [OCR Strategy: In-Process Tesseract.js vs. Managed Cloud OCR Services](#12-ocr-strategy-in-process-tesseractjs-vs-managed-cloud-ocr-services)
13. [Real-Time Streaming: Server-Sent Events (SSE) vs. WebSockets or Blocking REST](#13-real-time-streaming-server-sent-events-sse-vs-websockets-or-blocking-rest)
14. [Data Lifecycle: Soft Deletes with Application Cascade vs. Hard Deletes](#14-data-lifecycle-soft-deletes-with-application-cascade-vs-hard-deletes)
15. [Queue Polling: SQS Long Polling (20s) vs. Short Polling](#15-queue-polling-sqs-long-polling-20s-vs-short-polling)
16. [UX Resilience & Inspection: In-Window Document Preview & Failed Document Retry](#16-ux-resilience--inspection-in-window-document-preview--failed-document-retry)
17. [UX Ergonomics: Auto-Focus Chat Input on Natural Typing](#17-ux-ergonomics-auto-focus-chat-input-on-natural-typing)
18. [Contextual Retrieval & Conversational Memory: Summary in Embeddings & Sliding Chat Window](#18-contextual-retrieval--conversational-memory-summary-in-embeddings--sliding-chat-window)
19. [Public Landing Page: Conversion-Focused Onboarding vs. Raw Login Wall](#19-public-landing-page-conversion-focused-onboarding-vs-raw-login-wall)

---

## 1. Datastore Architecture: MongoDB as the Single Datastore

### The Decision
Initially considered using MySQL for `users`, RBAC, and permissioning, managed through Sequelize ORM and migration files, but finally decided to move the users data to MongoDB, managed through Mongoose ODM, and keep MongoDB as the single datastore.

### The Alternatives
1. **Retain the dual-persistence architecture:** MySQL for structured relational authentication data (`users` table) and MongoDB for flexible documents, chunks, sessions, and chat messages.
2. **Migrate everything to PostgreSQL with `pgvector`:** Replace both MySQL and MongoDB with a single PostgreSQL instance handling relational user data, document metadata, and vector embeddings in one engine.

### The Reasoning
The project initially launched with a dual-datastore design under the assumption that user accounts and passwords required relational ACID guarantees, while unstructured document chunks and chat logs belonged in a document store. 

In practice, running two databases for an MVP introduced massive operational drag:
- Maintaining two database connection pools, health checks, and environment configurations.
- Maintaining two distinct database migration patterns (Sequelize CLI migrations alongside Mongoose schema definitions).
- Hosting both Amazon RDS (MySQL) and MongoDB Atlas (or DocumentDB) on AWS, doubling infrastructure costs and operational complexity.

The `users` entity has a simple schema: `email`, `password` (bcrypt hash), `name`, and account status flags. It requires zero multi-table relational joins. MongoDB provides document-level atomicity and unique index constraints on `email`, satisfying all authentication requirements. Eliminating MySQL allowed cutting hundreds of lines of boilerplate, retiring Sequelize migrations, and running a single clean database connection pool.

---

## 2. Ingestion Pipeline: Asynchronous AWS SQS Worker vs. Synchronous HTTP Ingestion

### The Decision
Decoupled document processing from the API server. When a user uploads a document via `POST /api/v1/documents`, the API validates the file, uploads the raw binary to AWS S3, creates a `PENDING` record in MongoDB, enqueues an event to an AWS SQS queue, and immediately responds with `HTTP 202 Accepted`. A separate worker process (`backend/src/worker.js` running `documentConsumer.js`) consumes the queue, extracts text, performs chunking, generates embeddings via Gemini, and updates the document status to `COMPLETED` or `FAILED`.

### The Alternatives
1. **Synchronous in-band processing:** Parse PDF/OCR text, compute chunks, generate embeddings, and write to MongoDB directly within the `POST /api/v1/documents` HTTP handler.
3. **AWS S3 Event Notifications + AWS Lambda:** Trigger a Lambda function directly on S3 object creation.

### The Reasoning
Multi-page PDFs (up to 10MB) and image OCR extraction take between 10 and 60+ seconds. Generating vector embeddings for 50–200 chunks adds another 10–20 seconds of network latency. Keeping an HTTP connection open for 30–80 seconds:
- Exceeds the default 60-second timeout of AWS Application Load Balancers (ALBs) and web proxies, causing `504 Gateway Timeout` errors.
- Ties up Node.js HTTP worker memory and socket pools.
- Prevents users from navigating away while their files process.
- Offers zero automatic retryability if an external API (Gemini or S3) fails mid-processing.

AWS Lambda was rejected because bundling heavy native image processing and OCR binaries (`tesseract.js` worker dependencies and canvas libraries) inside Lambda deployment packages exceeds layer limits and incurs severe cold-start penalties.

**Tradeoffs accepted:** The frontend cannot receive an immediate success confirmation with extracted contents; it must poll the document endpoint (`PENDING` -> `PROCESSING` -> `COMPLETED`) to reflect processing status. A dedicated worker process must also be run and monitored alongside the API server.

### Intentional Decisions
- Real-time WebSocket / SSE push notifications for ingestion progress: client-side polling with backoff was simple, robust, and saved significant state-management complexity.
- Auto-scaling worker pools based on SQS queue depth (`ApproximateNumberOfMessagesVisible` CloudWatch metrics): a single concurrent worker loop was sufficient for MVP traffic.

---

## 3. Vector Storage & Retrieval: In-Memory Cosine Similarity vs. Dedicated Vector Database

### The Decision
The system stores 768-dimensional embedding vectors as native floating-point arrays directly in MongoDB `documentChunks.embedding`. For RAG retrieval, candidate chunks belonging to the current session and user (`sessionId`, `userId`, `isDeleted: false`) are fetched, and cosine similarity is computed against the query vector in-memory within Node.js.

### The Alternatives
1. **Dedicated managed vector databases:** Pinecone, Qdrant, Milvus, or Weaviate.
2. **Relational vector extensions:** PostgreSQL with `pgvector` and HNSW indexing.
3. **MongoDB Atlas Vector Search:** Using `$vectorSearch` aggregation pipelines with an Atlas search index.

### The Reasoning
Dedicated vector databases solve global vector search over millions of unpartitioned documents. However, in this application architecture, queries are **strictly scoped to an active session**. A user asks questions about documents attached to a specific `sessionId`, which typically comprises 1 to 5 documents (50 to 500 chunks).

Computing cosine similarity across 300 768-dimensional vectors in Node.js takes **~8 milliseconds**.

Introducing Pinecone or Qdrant would have introduced:
- Another external vendor dependency, API key, and billing account.
- An additional network roundtrip (adding 50–150ms per query).
- Distributed consistency bugs: deleting a document or session in MongoDB would require atomic synchronization with Pinecone, leading to orphaned vectors if a network call failed.

MongoDB Atlas Vector Search was considered, but tying the application to Atlas-proprietary `$vectorSearch` indexes would break compatibility with self-hosted MongoDB instances, local Docker development environments, and automated test runners. Storing vectors as raw arrays in MongoDB keeps local development zero-friction while delivering sub-10ms retrieval speeds.

**Tradeoffs accepted:** Global, cross-session semantic search cannot be performed across tens of thousands of documents without loading all chunks into memory. If an organization-wide knowledge base search across millions of chunks is ever needed, HNSW indexing will need to be introduced.

---

## 4. Embedding Pipeline: Chunk Batching and Concurrency Throttling

### The Decision
In `backend/src/service/geminiService.js`, I implemented batch chunk embedding using Gemini's batch API (`batchEmbedContents`) with a chunk batch size of 50, a concurrency limit of 2 parallel requests, and a forced 200ms inter-batch delay (`EMBEDDING_RATE_LIMIT_DELAY_MS`).

### The Alternatives
1. **Sequential one-by-one embedding:** Calling `ai.models.embedContent` in an iterative loop for every single text chunk.
2. **Unbounded parallel embedding:** Wrapping all chunks in `Promise.all(chunks.map(...))` to maximize network throughput.
3. **External rate-limiting middleware / token-bucket libraries.**

### The Reasoning
When chunk embeddings were first implemented sequentially, uploading a 20-page document (producing ~150 chunks) took over 80 seconds just for embedding generation. 

When switching to unbounded `Promise.all` across all chunks, the system fired 150 simultaneous HTTP requests to the Gemini API. Google immediately throttled the requests with `HTTP 429 RESOURCE_EXHAUSTED` (Rate limit exceeded), causing the entire background ingestion worker to crash and mark the document as `FAILED`.

Testing various batching and concurrency combinations revealed:
- A batch size of 100 with concurrency of 5 still triggered intermittent 429 quota breaches on free and pay-as-you-go tiers.
- A batch size of 50 with a concurrency limit of 2 and a 200ms pause settled at the optimal equilibrium: a 20-page document processes in ~8–12 seconds without ever triggering a 429 rate limit.

**Tradeoffs accepted:** Documents with 100+ pages take 45–60 seconds to process due to the deliberate concurrency ceiling.

---

## 5. LLM Model Strategy: Model Fallback Cascade & Primary Model Selection

### The Decision
I retained `gemini-3.5-flash` as the primary default LLM model for RAG answer generation, backed by an automated fallback cascade (`gemini-3.5-flash` -> `gemini-3.5-flash-lite` -> `gemini-3.6-flash`). Permanently downgrading the primary model to `gemini-3.5-flash-lite` was rejected, despite `flash-lite` being 10x faster.

### The Alternatives
1. **Permanently switch to `gemini-3.5-flash-lite`:** Drastically cut query latency from ~20s down to ~1.5s.
2. **Switch to another provider (OpenAI `gpt-4o-mini` or Anthropic `claude-3-5-haiku`):** Leverage alternative sub-second models.
3. **Hard-fail on API errors:** Return an error message to the user when the primary model hits 429 rate limits or 503 capacity errors.

### The Reasoning
In an effort to optimize the 20-second `/query` latency, I tested switching the primary model to `gemini-3.5-flash-lite`. While the response returned in ~1.5 seconds, user testing revealed an unacceptable collapse in answer quality:
- `gemini-3.5-flash` produced deep, well-structured syntheses that integrated findings across multiple document excerpts with accurate inline citations ([1], [2]).
- `gemini-3.5-flash-lite` produced shallow, superficial bulleted lists that resembled raw text dumps, omitted critical taxonomic and numerical details, and hallucinated missing information that was explicitly present in the provided chunks.

For a document intelligence platform, analytical fidelity and trustworthy citations are the core product value. Sacrificing comprehension depth for sub-second speed defeats the purpose of RAG. `gemini-3.5-flash` takes longer because it generates internal chain-of-thought "thinking" tokens before emitting text, which directly drives its superior synthesis.

However, because Gemini API free/tier-1 quotas enforce strict daily limits on `gemini-3.5-flash`, the service could not be allowed to fail when limits are hit. The fallback cascade automatically catches `429`, `503`, and `RESOURCE_EXHAUSTED` errors and seamlessly falls back to `gemini-3.5-flash-lite`, guaranteeing high availability under load while maintaining `gemini-3.5-flash` quality whenever capacity is available.

**Tradeoffs accepted:** Primary queries take 15–25 seconds to complete. The frontend mitigates this by using Server-Sent Events (SSE) streaming so the user sees live generation progress rather than a dead loading screen.

### Intentional Decisions
- Multi-provider fallback (OpenAI/Anthropic): adds multiple SDKs, differing prompt parameter schemas, and separate billing accounts.
- Dynamic `thinkingBudget` tuning: setting `thinkingBudget: 0` on `gemini-3.5-flash` proved unstable across Gemini API versions and led to invalid parameter errors.

---

## 6. RAG Latency Optimization: Parallel Retrieval & Compound Indexing

### The Decision
In `backend/src/service/ragService.js`, I refactored `retrieveRelevantChunks()` to execute the three independent retrieval operations—fetching session document associations, loading document chunks from MongoDB, and computing the user query's embedding vector via Gemini—concurrently using `Promise.all`. I also added compound MongoDB indexes on `documentChunks`: `{ sessionId: 1, userId: 1, isDeleted: 1 }` and `{ documentId: 1, isDeleted: 1 }`.

### The Alternatives
1. **Cache query embeddings in Redis:** Hash user queries and check a cache before calling Gemini.

### The Reasoning
In profiling why `/query` was taking over 20 seconds, I found that ~2.5 seconds of dead latency occurred before the LLM even started thinking. The code was executing in a strict procedural waterfall:
1. Query MongoDB for session documents (~50ms)
2. Query MongoDB for document chunks (~150ms)
3. Call Gemini Embedding API over the network (~1,800ms)

Because chunk retrieval and query embedding generation have no data dependencies on each other (both depend only on `sessionId` and the query string), executing them in parallel via `Promise.all` collapsed the total retrieval time to the duration of the slowest single operation (the embedding network call, ~350ms on warm connections).

Furthermore, `documentChunks` had no compound index covering `sessionId`, `userId`, and `isDeleted`. As the collection grew, MongoDB was performing partial collection scans. The compound index turned the chunk lookup into an indexed seek (< 5ms).

**Tradeoffs accepted:** If a user submits a query against an empty or invalid session, the embedding call to Gemini is still fired in parallel, consuming 1 embedding API call. This is mitigated by validating session ownership in the controller prior to invoking `retrieveRelevantChunks()`.

### Intentional Decisions
- Query embedding caching in Redis: user questions in document chat are highly unique and natural-language varied; cache hit rates would have been near zero.
- Asynchronous chunk prefetching based on user typing debounces.

---

## 7. Security Architecture: Mandatory `userId` Scoping for IDOR Elimination

### The Decision
I audited and hardened every controller, repository, SQS consumer, and RAG service method to enforce mandatory `userId` scoping. Any query that accesses documents, chunks, sessions, or chat history strictly requires a validated `userId` extracted from the authenticated JWT. If `userId` is missing or mismatched, the service throws an immediate `UnauthorizedError` / `ForbiddenError` instead of falling back to permissive queries.

### The Alternatives
1. **Rely solely on route-level auth middleware:** Assume that because `auth.js` verifies the JWT, controllers can query resources by `sessionId` or `documentId` alone.
2. **Permissive conditional filters:** Using patterns like `const filter = {}; if (userId) filter.userId = userId;`.

### The Reasoning
Insecure Direct Object Reference (IDOR) is one of the most critical vulnerability in a system.

If a developer accidentally omitted `userId` in a caller, or if an attacker manipulated the request parameters, MongoDB would execute `{ sessionId }` alone. If an attacker guessed or intercepted another user's `sessionId`, they could read confidential documents, extract chunk embeddings, or execute LLM completions against another organization's proprietary data.

All the queries were replaced to contain `userId` in the filter condition, non-negotiable parameter enforcement:
```javascript
// HARDENED PATTERN
if (!userId) {
  throw new UnauthorizedError('Unauthorized access: userId is required for data retreival');
}
const filter = { sessionId, userId, isDeleted: false };
```
This defense-in-depth approach ensures that even if an upper controller layer has a routing or validation bug, the database repository will refuse to execute an un-scoped query.

---

## 8. Deployment Architecture: Single-Container Bundle vs. Split Infrastructure

### The Decision
The compiled React/Vite frontend static assets were bundled directly into the Express backend (`backend/public`), deploying the entire application as a single Docker container to AWS ECS Fargate behind an Application Load Balancer (ALB).

### The Alternatives
1. **Split infrastructure:** Host the React SPA on AWS S3 behind a CloudFront CDN distribution, and host the Express API on AWS ECS Fargate (`api.domain.com`).
2. **Third-party hosting:** Deploy frontend to Vercel/Netlify and backend to Render/Railway.
3. **AWS Elastic Beanstalk / App Runner.**

### The Reasoning
Beyond the general operational complexity of managing two separate deployment pipelines, CORS headers, and cache invalidation routines, **the decisive blocker was an AWS account-level restriction**: attempting to provision a CloudFront distribution for the static S3 bucket resulted in an AWS error requiring contacting the AWS Support team to activate/verify the service for the account. Under tight delivery timelines, waiting 24–48+ hours for AWS Support ticket resolution would have completely stalled frontend deployment.

Shifting to a bundled Single Page Application (SPA) served directly from the Express backend (`backend/public`) bypassed this blocker entirely:
- **Zero AWS Support dependency:** Reuses the existing ECS Fargate service and Application Load Balancer (ALB) infrastructure already provisioned and operational, with no extra AWS services or approval tickets required.
- **Eliminated cross-origin complexity:** Consolidates frontend and backend under the same origin, eliminating CORS configurations, preflight `OPTIONS` latency, and separate domain/subdomain DNS routing.
- **Atomic, zero-version-skew releases:** Both the UI bundle and API update synchronously within the same immutable Docker image, preventing edge cases where updated frontend code hits a stale backend.
- **Simplified CI/CD:** A single GitHub Actions workflow builds and deploys the entire application stack in one pass.

Express serves the static assets with caching headers, while the existing ALB terminates TLS and handles ingress traffic.

**Tradeoffs accepted:** Static asset delivery consumes ECS container CPU and network bandwidth instead of being cached at edge CDN locations. Any frontend-only change requires rebuilding and rolling out the container.

### Intentional Decisions
- CloudFront CDN distribution and S3 static hosting bucket.
- Server-Side Rendering (SSR) or Next.js migration: client-side SPA routing inside Express is sufficient.
- Multi-region active-active deployment.

---

## 9. Build Strategy: Multi-Stage Linux Docker Build to Eliminate Native Binary Conflicts

### The Decision
`backend/Dockerfile` was structured as a multi-stage Docker build where Stage 1 builds the frontend in a native Linux Alpine environment (`node:20-alpine`), and Stage 2 installs backend production dependencies and copies the compiled `dist/` into `backend/public`.

### The Reasoning
The frontend relies on modern build tools: Vite 8 (which uses Rolldown, written in Rust) and Tailwind CSS v4 (which uses LightningCSS, written in Rust). Both libraries require platform-specific native C++/Rust binaries.

Because local development was performed on macOS ARM64 (Apple Silicon), the committed `package-lock.json` only recorded native bindings for `darwin-arm64`. When GitHub Actions (Ubuntu x86_64) ran `npm ci`, it failed with missing binary errors because `npm ci` strictly honors the lockfile and refuses to resolve unlisted platform binaries.

Attempting to force Linux packages into `optionalDependencies` caused cross-platform lockfile conflicts between macOS and CI. Committing `dist/` to git is an anti-pattern that pollutes git history with hundreds of minified files and leads to merge conflicts.

The multi-stage Docker build solved this completely:
```dockerfile
# Stage 1: Build Frontend natively inside Linux
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine
WORKDIR /app/backend
...
COPY --from=frontend-builder /app/frontend/dist ./public
```
By running `npm install` inside a Linux container, npm resolves the exact Linux x86_64 native binaries natively, guaranteeing 100% reproducible builds regardless of whether the build is run on a Mac, Windows, or Linux CI runner.

**Tradeoffs accepted:** The Docker build context must be sent from the repository root (monorepo root) rather than `backend/`, and Docker builds on CI take more time because dependencies are resolved inside the container.

### Intentional Decisions
- Pre-built binary check-in to git.
- Docker Buildx multi-arch cross-compilation (`linux/arm64` and `linux/amd64`): builds target strictly `linux/amd64` to match ECS Fargate targets.

---

## 10. CI/CD Pipeline: Manual GitHub Actions Workflow Dispatch with Environment Secrets

### The Decision
The deployment workflow (`.github/workflows/deploy.yml`) was configured to trigger exclusively via `workflow_dispatch` (manual button click in GitHub UI) with an explicit `environment` dropdown parameter (`production`). The workflow references all AWS configuration, cluster names, service names, and credentials from GitHub Actions Environment secrets (`vars.*` and `secrets.*`), with **zero hardcoded values** in the repository YAML.

### The Alternatives
1. **Automatic continuous deployment on push to `master`:** Automatically trigger Docker build and ECS deployment on every git commit.
2. **Hardcode infrastructure constants in YAML:** Hardcode `AWS_REGION: ap-south-1`, `ECR_REPOSITORY: pagesense-api`, and `ECS_SERVICE: pagesense-api-task-service-a8hh1z3n` directly in the workflow file.
3. **Use repository-level secrets instead of Environment secrets.**

### The Reasoning
Automatic deployment on every push is dangerous during active prototyping and refactoring. A quick commit fixing a typo or documentation file would trigger an unnecessary 5-minute AWS ECS rollout, cycling production containers and burning CI minutes. A manual `workflow_dispatch` trigger requires an explicit, deliberate operator action.

Hardcoding infrastructure identifiers (ECR repo names, ECS cluster names, auto-generated AWS service IDs like `pagesense-api-task-service-a8hh1z3n`) in the YAML couples the codebase to specific AWS account setups and leaks infrastructure topology in public/shared git history.

Using GitHub **Environment secrets** (under environment `production`) rather than global repository secrets provides:
- Clean isolation of credentials.
- The ability to configure deployment protection rules (required reviewers).
- Strict separation between future staging and production environments.

**Tradeoffs accepted:** Deployments are not continuous; an engineer must manually click "Run workflow" in GitHub Actions to release new code.

### Intentional Decisions
- Automated canary traffic shifting via AWS CodeDeploy: standard ECS rolling update deployments (`minimumHealthyPercent: 100`) were sufficient.
- Automated staging-to-production promotion pipelines.

---

## 11. Pagination Strategy: Cursor-Based Pagination vs. Offset/Limit

### The Decision
Cursor-based pagination was implemented for document and session listings with infinite scrolling on the client side, using MongoDB `_id` / `createdAt` with `$lt` filters and base64-encoded cursor tokens.

### The Alternatives
1. **Offset and limit pagination:** Using `skip((page - 1) * limit).limit(limit)`.
2. **Client-side pagination:** Returning all documents/sessions in a single payload and slicing arrays in the React frontend.

### The Reasoning
Offset pagination (`skip` / `limit`) has two fatal flaws in a live document processor:
1. **Performance degradation:** In MongoDB, `.skip(1000)` requires the query planner to walk through and discard 1,000 documents in memory before returning results. As data grows, latency scales linearly O(N).
2. **Page drift / missing records:** Users frequently upload new documents or create sessions while browsing. With offset pagination, if a user is on page 1 and a new document is ingested, moving to page 2 causes the last item of page 1 to shift into page 2, displaying a duplicate item to the user. Conversely, deleting an item causes records to be skipped entirely.

Cursor-based pagination using the natural monotonically decreasing `_id` (or `createdAt` timestamp) provides indexed seek performance of O(1) regardless of pagination depth, and is completely immune to page drift from concurrent insertions or deletions.

**Tradeoffs accepted:** Users cannot jump to an arbitrary page number (e.g., "Jump to page 7"); navigation is strictly sequential ("Next page" / "Load more").

### Intentional Decisions
- Bi-directional cursor pagination (backward pagination via `before` cursors).
- Real-time total page count recalculation on every cursor fetch (costly count operations omitted).

---

## 12. OCR Strategy: In-Process Tesseract.js vs. Managed Cloud OCR Services

### The Decision
`tesseract.js` was integrated directly within the Node.js background worker to extract text from uploaded images (`image/png`, `image/jpeg`).

### The Alternatives
1. **AWS Textract:** Call AWS Textract via SDK for managed OCR and form/table extraction.
2. **Google Cloud Vision API:** Call Google Vision API for text detection.
3. **Reject image uploads entirely:** Support only pre-parsed text files and native digital PDFs.

### The Reasoning
Managed cloud OCR services like AWS Textract or Google Cloud Vision provide exceptional accuracy, but they introduce:
- Additional per-page billing costs that can escalate unpredictably on high-volume uploads.
- Additional IAM permissions, credentials, and network latency hops.
- Third-party cloud vendor lock-in.

`tesseract.js` runs self-contained as a WebAssembly/C++ worker within the Node.js process without any external cloud credentials or network dependencies. Because OCR execution occurs asynchronously in the background SQS worker, the intense CPU usage of Tesseract never blocks Express HTTP request handling threads or user interactions.

**Tradeoffs accepted:** `tesseract.js` has lower accuracy on handwritten or low-contrast scanned text compared to AWS Textract. It also increases container memory usage during active OCR extraction.

### Intentional Decisions
- Multi-language OCR dictionaries (bundled English only).
- Table, form, and bounding-box layout extraction.
- Automatic image pre-processing (deskewing, contrast adjustment, binarization).

---

## 13. Real-Time Streaming: Server-Sent Events (SSE) vs. WebSockets or Blocking REST

### The Decision
HTTP Server-Sent Events (`text/event-stream`) were implemented in `backend/src/controller/queryController.js` to stream generated RAG completion tokens to the React chat interface in real time.

### The Alternatives
1. **Bi-directional WebSockets (Socket.io or `ws`):** Establish persistent full-duplex socket connections between client and server.
2. **Blocking JSON REST response:** The client awaits a single `POST /query` response containing the full answer text after generation finishes.

### The Reasoning
Because `gemini-3.5-flash` with internal reasoning takes between 15 and 25 seconds to generate comprehensive answers, a blocking HTTP response creates an atrocious user experience: the user stares at a loading spinner for 20 seconds, unsure if the backend crashed or the network dropped.

Server-Sent Events (SSE) provide immediate Time-To-First-Token (TTFT), streaming words to the screen as the LLM emits them. 

WebSockets were considered, but full-duplex bi-directional communication is unnecessary for a request-response query model: the client sends a query once, and the server streams tokens back. WebSockets require:
- Custom connection heartbeat/ping-pong handling.
- Complex connection state tracking across server restarts.
- Load balancer WebSocket upgrade configurations and sticky session routing on AWS ALB.

SSE operates over standard HTTP/1.1 or HTTP/2, requires no handshake protocols, traverses corporate firewalls and proxies without issue, and works out-of-the-box through standard AWS Application Load Balancers.

**Tradeoffs accepted:** The communication channel is strictly unidirectional from server to client.

### Intentional Decisions
- Mid-stream cancellation: client cannot abort an in-flight LLM generation stream mid-token (the stream runs to completion on the server even if the browser tab closes).
- Bi-directional typing indicators and presence tracking.

---

## 14. Data Lifecycle: Soft Deletes with Application Cascade vs. Hard Deletes

### The Decision
Soft deletes (`isDeleted: true`, `deletedAt: new Date()`) were standardized across all MongoDB collections (`documents`, `documentChunks`, `sessions`, `chatMessages`), filtering active queries with `{ isDeleted: false }`.

### The Alternatives
1. **Hard database deletion:** Using `deleteOne` and `deleteMany` to physically remove records from disk.
2. **Database-level triggers / TTL collections.**

### The Reasoning
In an asynchronous document processing system, hard deletions create severe race conditions and data corruption:
- If a user deletes a document while an SQS background worker is currently chunking or embedding it, hard deletion causes the worker to crash with `Document not found` errors or write orphaned chunks to MongoDB after the parent document is already gone.
- If a user deletes a session while a long-running RAG query is streaming, hard deletion crashes the streaming handler midway through generation.

Soft deletion ensures that all active asynchronous operations complete safely against immutable historical records. It also maintains a reliable audit trail and makes it straightforward to add an "Undo" or "Trash" feature in the future.

**Tradeoffs accepted:** Storage footprint grows monotonically until records are purged; every single query, aggregation pipeline, and compound index must include `{ isDeleted: false }`.

### Intentional Decisions
- Automated background TTL cleanup workers to permanently purge records soft-deleted > 30 days ago.
- User-facing "Trash / Bin" recovery interface.

---

## 15. Queue Polling: SQS Long Polling (20s) vs. Short Polling

### The Decision
In `backend/src/config/sqs/sqsClientConfig.js`, the SQS consumer client was configured with `WaitTimeSeconds: 20` (long polling) and `MaxNumberOfMessages: 5`.

### The Alternatives
1. **Short polling:** Default `WaitTimeSeconds: 0` in a tight loop.
2. **Event-driven AWS Lambda triggers.**

### The Reasoning
AWS SQS bills per million API requests (`ReceiveMessage`). When a consumer uses short polling (`WaitTimeSeconds: 0`), an idle worker continuously hammers the SQS API multiple times per second, generating hundreds of thousands of empty API calls per day even when no documents are being uploaded. This burns AWS budget and consumes unnecessary CPU cycles in the Node.js event loop.

With long polling (`WaitTimeSeconds: 20`), the SQS connection stays open up to 20 seconds. If a message arrives at second 2, SQS returns it immediately; if no message arrives, the request completes after 20 seconds. This simple configuration change reduced empty SQS API calls by over 95%, virtually eliminated polling costs, and reduced message pickup latency to near zero.

**Tradeoffs accepted:** Graceful worker process shutdown takes up to 20 seconds to drain an active pending long-poll request.

### Intentional Decisions
- SQS FIFO (First-In, First-Out) queues: document processing jobs are completely independent; standard queues offer virtually unlimited throughput and lower pricing without the need for message group IDs.

---

## 16. UX Resilience & Inspection: In-Window Document Preview & Failed Document Retry

### The Decision
Added two critical capabilities directly inside the session workspace interface (`frontend/src/components/workspace/`):
1. **In-Window Document Preview Modal (`DocumentPreviewModal.jsx`)**: Allowed users to view extracted document text chunks, source pages, and download raw files via secure S3 pre-signed URLs without leaving the active chat session or navigating away.
2. **One-Click Ingestion Retry (`POST /api/v1/documents/:documentId/retry`)**: Added a direct retry button on failed document list items (`DocumentListItem.jsx`) that resets document status back to `PENDING` and re-publishes the processing job to the AWS SQS queue without requiring the user to re-upload the file to S3.

### The Alternatives
1. **External Tab / Download Only for Inspection**: Forcing users to download files locally or open raw files in external browser tabs to inspect their content or verify citations.
2. **Mandatory Re-Upload on Processing Failure**: If a document failed during background processing (due to transient Gemini 429 rate limits, S3 socket timeouts, or OCR worker spikes), requiring the user to manually re-select and re-upload the original file from their local disk.
3. **Full Canvas PDF Reader**: Embedding a full-weight PDF rendering library (such as `pdf.js` / `react-pdf` with canvas rendering) inside the chat interface.

### The Reasoning
Document Q&A and RAG workflows require immediate trust and rapid verification. When a user receives an answer with citations like `[1]` or `[2]`, or wants to check what text was extracted from an image or scanned PDF, forcing them to leave the workspace or download the file disrupts their analytical flow. The in-window preview modal provides immediate contextual inspection of the exact ingested text chunks alongside a download action, maintaining user focus within the conversation.

For ingestion failures, document processing can fail due to transient third-party issues: Gemini API 429 rate limit breaches, S3 network hiccups, or OCR memory spikes. If a 20MB file fails on chunk embedding, forcing the user to re-upload the file over a slow network connection is a frustrating user experience and wastes network bandwidth. 

Because the raw file is already safely persisted in S3 and document metadata exists in MongoDB, the retry endpoint simply updates the document status to `PENDING` and re-enqueues the SQS message with the existing S3 key. This turns a multi-step user recovery workflow into a single click.

**Tradeoffs accepted:** The in-window preview modal renders extracted text chunks rather than full high-fidelity visual PDF canvas pages with zoom/pan controls (to keep frontend bundle size light and avoid `pdf.js` memory bloat).

### Intentional Decisions
- Embedding a heavyweight PDF canvas viewer (`pdf.js` / `react-pdf`) with full multi-page visual layout rendering: extracted text chunks with S3 download links delivered 90% of the verification utility at a fraction of the bundle weight.
- Automatic infinite auto-retry on the backend without user consent: avoided to prevent poisonous/corrupted files from looping infinitely and burning SQS/Gemini quota. Instead, the UI provides explicit user-driven retry alongside dead-letter queue limits.

---

## 17. UX Ergonomics: Auto-Focus Chat Input on Natural Typing

### The Decision
In `frontend/src/components/workspace/ChatInterface.jsx`, implemented a global keydown event listener that intercepts printable keystrokes typed anywhere on the page and transfers focus immediately to the chat query input (`inputRef.current?.focus()`), allowing the browser to capture the user's typed characters without dropping the first keystroke.

### The Alternatives
1. **Default browser focus behavior**: Requiring users to explicitly click the text input with their mouse every time they want to ask a question or continue a conversation.
2. **Mount-only autofocus (`autoFocus` attribute)**: Focusing the input once when the workspace initially mounts.
3. **Shortcut-triggered focus (`Cmd+K` / `/` slash key command palette)**: Requiring the user to remember a keyboard shortcut to jump focus to the input box.

### The Reasoning
In a document intelligence workspace, user interactions are highly fragmented across multiple peripheral UI elements: uploading documents, dragging files, opening citation drawers, toggling chunk preview modals, or clicking download links. 

Every time a user clicked any button, closed a modal, or selected an item, browser focus was shifted away from the chat prompt box. During usability testing, having to repeatedly reach for the mouse to click back into the input box before typing was a major friction point and broke conversational flow. Users naturally expected to begin typing their thoughts immediately after reviewing a document or reading an answer.

The global keydown listener solves this by detecting when the user begins typing. It intentionally filters out non-target interactions:
- It ignores modifier key combinations (`metaKey`, `ctrlKey`, `altKey`) so OS and browser shortcuts (like `Cmd+C`, `Cmd+V`, `Cmd+R`) remain unaffected.
- It ignores keystrokes when focus is already inside another editable element (`input`, `textarea`, `select`, or `contentEditable`).
- It ignores keystrokes when interacting with the file dropzone (`[data-dropzone]`) to prevent accidental file picker triggers.
- It ignores non-printable navigation keys (arrows, Escape, Tab, function keys).
- It ignores typing when an LLM answer is actively streaming and the input is disabled.
- When <kbd>Enter</kbd> is pressed anywhere in the workspace while text is present in the prompt input (and focus is not on a button, link, or dropzone), it immediately dispatches the prompt, clears the input, and preserves conversational momentum.

When a valid printable character (`e.key.length === 1`) is pressed, focus is instantly redirected to the input box, allowing the browser's native event pipeline to insert the character seamlessly.

**Tradeoffs accepted:** Users cannot bind single un-modified letter keys as global hotkeys (e.g., pressing `j` or `k` for vim-style navigation) without triggering input focus.

### Intentional Decisions
- Implementing a separate command palette modal (`Cmd+K`): natural ambient typing focus felt more intuitive for a conversational interface and required zero cognitive overhead or shortcut memorization.
- Forcing synthetic focus trapping / modal focus locks: would have created accessibility conflicts with screen readers and keyboard tab navigation.

---

## 18. Contextual Retrieval & Conversational Memory: Summary in Embeddings & Sliding Chat Window

### The Decision
1. **Contextual Retrieval (Summary in Embeddings)**: Document ingestion was updated so the document-level summary (`generateDocumentSummary(rawText)`) is generated first. When computing vector embeddings for chunks, each chunk's embedding input is contextualized with the document name and executive summary (`Document: <fileName>\nSummary: <summary>\n\nContent:\n<chunk.content>`). The clean, original chunk content is preserved in MongoDB for citations and UI rendering.
2. **Conversational Memory Window**: Chat query completions include a sliding window of the past 4–6 messages (`CHAT_HISTORY_MESSAGE_LIMIT: 6`, configurable in `GEMINI_CONFIG`) fetched via `findRecentBySession`. These prior dialogue turns are passed into the LLM prompt alongside the retrieved document chunks.

### The Alternatives
1. **Isolated chunk embeddings without summary context**: Computing embeddings solely on raw chunk text without document-level domain knowledge.
2. **Stateless single-turn chat**: Treating every user question independently without passing prior turns, forcing users to re-state context or document names in follow-up queries.
3. **Full unbounded conversation history**: Passing every single message from the session into the LLM context.

### The Reasoning
* **Why Contextual Embeddings**: Standard chunking isolates paragraphs from their broader document context. A chunk describing financial figures or contract clauses often omits the company name or document purpose mentioned on page 1. Prepending the document summary and file name to the text passed to `embedContent` gives each vector embedding global semantic grounding. Cosine similarity retrieval can now surface relevant excerpts even when the chunk itself doesn't contain all document-level keywords.
* **Why Sliding Chat Window (4–6 messages)**: Natural human conversation relies on follow-up questions (e.g. *"What about the second one?"*, *"Can you explain that in more detail?"*). Without recent context, the LLM cannot resolve pronouns or references to prior answers. Passing the last 6 messages provides conversational continuity while avoiding token bloat, latency degradation, and attention dilution.

**Tradeoffs accepted:** Ingestion pipeline runs sequentially (summary first, then chunk embeddings) rather than fully in parallel, adding 1–2 seconds to the ingestion worker job in exchange for significantly higher vector retrieval accuracy.

---

## 19. Public Landing Page: Conversion-Focused Onboarding vs. Raw Login Wall

### The Decision
Introduced a dedicated, content-rich public landing page (`frontend/src/pages/LandingPage.jsx`) at the root URL (`/`), replacing the default behavior where unauthenticated visitors were immediately blocked by a raw login/signup card (`LoginPage.jsx`).

### The Reasoning
The primary driver for introducing a dedicated landing page was to **push organic visitors toward account signup by demonstrating tangible value before asking for credentials**:
- **Eliminating Bounce Friction for Organic Traffic**: When prospective users arrive via organic search, social links, or word-of-mouth, hitting an abrupt login form with zero context creates immediate cognitive friction and high bounce rates. Visitors are reluctant to create an account or provide an email without understanding what the product does.
- **Showcasing Product Value & Verification Trust**: An interactive mock workspace preview on the landing page immediately demonstrates the application's unique value proposition: multi-format document ingestion, real-time conversational streaming, and verifiable page-level source citations. Seeing how citations work builds immediate trust.
- **Target Persona Alignment (MVP)**: The landing page explicitly frames use cases for target audiences—academic researchers, product managers, and content writers—clarifying immediate workflows and prompting signups.
- **Single-Origin Deployment Simplicity**: Rather than managing, designing, and hosting a secondary marketing website on external platforms, building the landing page natively into the React SPA delivers a seamless transition: clicking "Get Started Free" opens the signup modal directly on the same page with zero redirect lag or cross-domain authentication friction.

---

## 20. Non-Code Text & Structured Data Ingestion Expansion

### The Decision
Expanded the supported document ingestion catalog across the backend file filter (`fileFilter.js`, `fileTypes.js`) and frontend dropzone (`DocumentDropzone.jsx`) to include all major non-code plaintext and structured data formats:
- **Markdown**: `.md`, `.markdown` (`text/markdown`, `text/x-markdown`, `text/plain`)
- **Tabular Data**: `.csv`, `.tsv` (`text/csv`, `text/tab-separated-values`, `text/tsv`)
- **Structured Data & Markup**: `.json` (`application/json`), `.xml` (`application/xml`, `text/xml`), `.html`, `.htm` (`text/html`)
- **Configurations & Logs**: `.yaml`, `.yml` (`application/x-yaml`, `text/yaml`), `.log` (`text/plain`, `text/x-log`)
- Explicitly excluded executable code formats (`.py`, `.js`, `.ts`, `.sh`, `.sql`).

### The Reasoning
The ingestion pipeline's text-extraction architecture inherently decodes non-binary payloads via `buffer.toString('utf-8')` before applying semantic character chunking and vector embedding generation. Consequently, adding support for Markdown, CSV, JSON, XML, YAML, HTML, and log files required zero new runtime parsing libraries or heavyweight dependencies, immediately unlocking rich tabular and structured data retrieval for users with zero performance penalty. Code formats were intentionally excluded to prevent syntactic token bloat and maintain relevance for document and research analysis.

