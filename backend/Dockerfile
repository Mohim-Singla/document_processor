FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies needed for native modules / build tools if any
RUN apk add --no-cache python3 make g++

# Copy package manifests first for optimal Docker layer caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Expose backend HTTP port
EXPOSE 8000

# Set production environment
ENV NODE_ENV=production
ENV PORT=8000

# Default command starts Express server
CMD ["node", "src/app.js"]
