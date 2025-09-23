# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY web/package*.json web/
COPY shared/package*.json shared/

# Install dependencies
RUN npm ci

# Copy source code
COPY web/ web/
COPY shared/ shared/

# Build the application
RUN npm run build --workspace=web

# Stage 2: Production
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/web/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
