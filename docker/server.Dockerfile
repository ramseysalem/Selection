# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json server/
COPY shared/package*.json shared/

# Install dependencies
RUN npm ci

# Copy source code
COPY server/ server/
COPY shared/ shared/

# Build the application
RUN npm run build --workspace=server

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json server/
COPY shared/package*.json shared/

# Install production dependencies
RUN npm ci --production

# Copy built application
COPY --from=builder /app/server/dist server/dist
COPY --from=builder /app/shared/dist shared/dist

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start", "--workspace=server"]
