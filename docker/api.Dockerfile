# Base image
FROM node:20-slim AS base

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

# Set working directory
WORKDIR /app

# Copy root tsconfig
COPY tsconfig.json ./tsconfig.json

# Copy API package files
COPY packages/api/package*.json ./packages/api/
COPY packages/api/prisma ./packages/api/prisma/

# Install dependencies
WORKDIR /app/packages/api
RUN npm install

# Copy API source code
COPY packages/api/ ./

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
