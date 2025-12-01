# Frontend Dockerfile - React + Vite (Multi-stage build)

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build argument for API URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build the application
RUN npm run build

# Stage 2: Production
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config as template (nginx:alpine auto-processes templates)
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Default port (Railway overrides with PORT env var)
ENV PORT=80

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
