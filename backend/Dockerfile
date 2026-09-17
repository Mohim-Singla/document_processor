# ==========================================
# Stage 1: Build Frontend Static Bundle
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend package manifests and install dependencies natively on Linux
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source and build Vite bundle
COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Production Backend Runtime
# ==========================================
FROM node:20-alpine
WORKDIR /usr/src/app

# Install native dependencies needed for compilation (e.g. tesseract, bcrypt)
RUN apk add --no-cache python3 make g++

# Copy backend package manifests and install production dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy backend application source
COPY backend/ ./

# Copy compiled frontend production bundle from Stage 1 into backend's public directory
COPY --from=frontend-builder /app/frontend/dist ./public

EXPOSE 8000
ENV NODE_ENV=production
ENV PORT=8000

CMD ["node", "src/app.js"]
