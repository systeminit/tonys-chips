# Stage 1: Build React app
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY packages/web/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY packages/web/ ./

# Set API URL for production build
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

# Build the app
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy custom nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
