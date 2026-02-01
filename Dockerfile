FROM node:22-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and static files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Copy public files for production serving
RUN cp -r src/public ./public

# Cleanup dev dependencies
RUN npm prune --production

# Create data directory
RUN mkdir -p /data

# Run
ENV NODE_ENV=production
ENV PORT=8080
ENV CLAWTLAS_DB=/data/clawtlas.db
EXPOSE 8080

CMD ["node", "dist/index.js"]
