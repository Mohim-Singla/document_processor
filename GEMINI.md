# Architecture Documentation: Document Processor Service (`document_processor`)

## Overview

The `document_processor` microservice (internally named `node_service`) is a Node.js web application built with **Express.js** adhering to modern ES Modules standard (`type: module`). It utilizes a polyglot persistence architecture, integrating both **MySQL** (relational database via Sequelize ORM) and **MongoDB** (document store via Mongoose ORM).

The codebase is structured around clear separation of concerns, dividing application layers into Routes, Controllers, Services, Repositories, Data Models, Middlewares, and Utilities.

---

## Technical Stack

| Layer / Concern | Technology / Library | Description |
| :--- | :--- | :--- |
| **Runtime Environment** | Node.js (ESM) | Asynchronous event-driven JavaScript runtime |
| **Web Framework** | Express.js (`v4.21.1`) | HTTP routing and middleware framework |
| **Relational Database** | MySQL 8.x + Sequelize ORM (`v6.37.5`) | Structured data persistence (e.g., Users) |
| **Document Database** | MongoDB + Mongoose (`v8.8.1`) | Unstructured / semi-structured data persistence (e.g., Messages) |
| **Validation** | Joi (`v17.13.3`) | Schema validation for HTTP request bodies, queries, and params |
| **Authentication & Security** | `jsonwebtoken`, `bcryptjs`, `cors` | Token-based authentication, password hashing, CORS control |
| **Logging & Utilities** | `debug`, `lodash`, `uuid` | Contextual logging and helper utilities |
| **Code Style & Linting** | ESLint (`v9.14.0`) | ECMAScript linting and quality rules |

---

## High-Level Architecture Diagram

```mermaid
graph TD
    Client[Client / Frontend Application] -->|HTTP Requests| ExpressApp[Express Server (src/app.js)]

    subgraph Middleware Pipeline
        ExpressApp --> CORS[CORS Middleware]
        CORS --> BodyParser[JSON & URL-Encoded Body Parsers]
        BodyParser --> DebugLogger[Debug Logger (src/middleware/debug.js)]
        DebugLogger --> ResponseHandler[Response Handler (src/middleware/responseHandler.js)]
    end

    subgraph Routing & Business Logic
        ResponseHandler --> Router[Router (src/route/index.js)]
        Router --> V1Router[API v1 Router (src/route/v1/index.js)]
        V1Router --> Validator[Request Validator (src/middleware/requestValidator.js)]
        Validator --> Controller[Controllers (src/controller/)]
        Controller --> Service[Services (src/service/)]
    end

    subgraph Persistence Layer
        Service --> MySQLRepo[MySQL Repository (src/db/mysql/repository/)]
        Service --> MongoRepo[MongoDB Repository (src/db/mongo/repository/)]
        
        MySQLRepo --> SequelizeModel[Sequelize Models (Users)]
        MongoRepo --> MongooseModel[Mongoose Models (Messages)]
        
        SequelizeModel --> MySQLDB[(MySQL Database)]
        MongooseModel --> MongoDB[(MongoDB Database)]
    end
```

---

## Project Directory Layout

```
document_processor/
├── .env.example                  # Template for environment configuration
├── .gitignore                    # Git exclusion patterns
├── .sequelizerc                  # Sequelize CLI configuration path mappings
├── eslint.config.js              # ESLint configuration
├── package.json                  # Dependencies, scripts, and ESM module flag
├── README.md                     # Base project readme
└── src/
    ├── app.js                    # Application entry point & server bootstrap
    ├── apiValidations/           # Request validation schemas (Joi)
    │   ├── auth.js               # Authentication request validation schemas
    │   └── index.js              # Central validation registry
    ├── config/                   # Global configuration & database connection parameters
    │   ├── database/
    │   │   ├── mongoConnectionConfig.js
    │   │   └── mysqlConnectionConfig.js
    │   └── index.js
    ├── controller/               # HTTP request handlers / controllers
    │   └── index.js
    ├── db/                       # Database initialization, models, and repositories
    │   ├── mongo/
    │   │   ├── connection/       # MongoDB connection initializer
    │   │   ├── models/           # Mongoose schemas (e.g. messages.js)
    │   │   └── repository/       # Data access abstractions for MongoDB
    │   └── mysql/
    │       ├── connection/       # MySQL Sequelize connection initializer
    │       ├── migrations/       # Database migrations (e.g. create-users)
    │       ├── models/           # Sequelize models (e.g. users.js)
    │       └── repository/       # Data access abstractions for MySQL
    ├── middleware/               # Express middleware implementations
    │   ├── debug.js              # Request logging middleware
    │   ├── requestValidator.js   # Middleware executing Joi schemas
    │   └── responseHandler.js    # Custom res.success and res.error response methods
    ├── route/                    # Route definitions
    │   ├── index.js              # Root router mapping
    │   └── v1/                   # Version 1 API endpoints
    ├── service/                  # Business logic services
    │   └── index.js
    └── utils/                    # Shared utility functions and constants
        ├── common/
        ├── constant/
        └── index.js
```

---

## Core Components & Architectural Pattern

### 1. Application Entry Point (`src/app.js`)
- Initializes Express application and HTTP server.
- Registers global middlewares: `cors`, body parsers, `debugLogger`, and `responseHandler`.
- Concurrent initialization of database connections via `Promise.all([mongoConnection.init(), mysqlConnection.init()])`.
- Health check endpoint available at `/ping`.
- Binds application routes to versioned base path (`/v1`).

### 2. Dual Database Persistence Strategy
- **MySQL Data Layer (`src/db/mysql/`)**:
  - Managed via Sequelize ORM.
  - Relational schema definitions stored in `models/`.
  - Database schema alterations governed via Sequelize CLI migrations in `migrations/`.
  - Query encapsulation provided via repository functions (e.g., `users.fetchOne`, `users.create`).
- **MongoDB Data Layer (`src/db/mongo/`)**:
  - Managed via Mongoose ODM.
  - Schema definitions stored in `models/` (e.g., `messages.js` with `userId`, `groupId`, `messageContent`, `timestamp`).
  - Data access abstracted via repository pattern (`messages.js`).

### 3. Middleware Layer (`src/middleware/`)
- **`responseHandler.js`**: Decorates Express `res` object with structured helper functions:
  - `res.success(message, response, statusCode)` -> Returns `{ status: 'Success', message, statusCode, response }`
  - `res.error(message, error, statusCode, errorCode)` -> Returns `{ status: 'Success', message, errorCode, error }`
- **`requestValidator.js`**: Validates request parameters/bodies against Joi schemas before hitting controller logic.
- **`debug.js`**: Logs request details using `debug('app:request')`.

---

## Data Models

### MySQL: `users`
- `userId`: String (Unique identifier)
- `email`: String (Required)
- `name`: String
- `password`: String (Hashed)
- `isEnabled`: Boolean

### MongoDB: `messages`
- `userId`: String (Required)
- `groupId`: String (Required)
- `messageContent`: String (Required)
- `timestamp`: Date (Default: `Date.now`)

---

## Environment & Scripts

### Available NPM Scripts

```bash
# Start service in development mode with debug logging enabled
npm start

# Run prestart tasks (Create DB, run migrations, seed initial data)
npm run prestart

# Run Sequelize database migrations
npm run db:migrate

# Seed database with initial datasets
npm run db:seed

# Rollback migrations / seeds
npm run db:undo-migrate
npm run db:undo-seed

# Fix linting errors across codebase
npm run lint:fix
```
