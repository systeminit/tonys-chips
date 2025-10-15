# Playwright E2E Tests Docker Container
# Uses official Playwright image with browsers pre-installed

FROM mcr.microsoft.com/playwright:v1.56.0-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy test files and configuration
COPY playwright.config.ts ./
COPY e2e/ ./e2e/
COPY tsconfig.json ./

# Environment variables (can be overridden at runtime)
ENV API_URL=http://localhost:3000
ENV WEB_URL=http://localhost:8080
ENV CI=true

# Run tests
CMD ["npx", "playwright", "test"]
