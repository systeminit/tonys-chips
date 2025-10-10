# Express web server
FROM node:20-slim

WORKDIR /app

# Copy root tsconfig.json (needed for extends)
COPY tsconfig.json /app/

# Create packages directory structure
WORKDIR /app/packages/web

# Copy package files
COPY packages/web/package*.json ./

# Install dependencies
RUN npm install

# Copy source code and views
COPY packages/web/ ./

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Start the Express server
CMD ["npm", "start"]
