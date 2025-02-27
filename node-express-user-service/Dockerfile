# Stage 1: Build stage
FROM node:20-alpine AS builder
LABEL maintainer="tipsukanya.n@ku.th"
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy only package.json & package-lock.json for faster caching
COPY package*.json ./

# Install dependencies with native modules rebuilt in the correct environment
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Stage 2: Production stage (small final image)
FROM node:20-alpine
WORKDIR /app

# Copy only built application and dependencies from previous stage
COPY --from=builder /app /app

# Expose port 8080 (Cloud Run expects this)
EXPOSE 8080

# Start the app
CMD ["node", "app.js"]
