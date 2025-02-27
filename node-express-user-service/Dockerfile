# Stage 1: Build stage
FROM node:20-alpine AS builder
LABEL maintainer="tipsukanya.n@ku.th"
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Force native modules to build from source
ENV npm_config_build_from_source=true

# Copy only package.json & package-lock.json for dependency installation
COPY package*.json ./

# Install dependencies (re-downloaded and built in the Cloud Build environment)
RUN npm ci --omit=dev

# Optionally, force rebuild bcrypt
RUN npm rebuild bcrypt --build-from-source

# Copy application source code
COPY . .

# Stage 2: Production stage
FROM node:20-alpine
WORKDIR /app

# Copy built application and dependencies from the builder stage
COPY --from=builder /app /app

# Expose port 8080 (as required by Cloud Run)
EXPOSE 8080

# Start the app
CMD ["node", "app.js"]
