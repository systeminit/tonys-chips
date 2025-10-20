# Tony's World of Chips

A demo e-commerce application showcasing the full lifecycle of automated software development with **System Initiative**.

## Overview

Tony's World of Chips is a full-stack TypeScript application that demonstrates how System Initiative can automate the entire software development lifecycle - from infrastructure provisioning to application deployment. This sample app implements a complete online store for purchasing potato chips, featuring an Express.js server-side rendered frontend with EJS templates, Express.js REST API backend, and PostgreSQL database.

## Architecture

This project is organized as a monorepo with the following structure:

- **`packages/api/`** - Express.js REST API with Prisma ORM
- **`packages/web/`** - Express.js server-side rendered frontend with EJS templates
- **`docker/`** - Dockerfiles for containerized deployment
- **`.github/workflows/`** - CI/CD automation with GitHub Actions

### Technology Stack

- **Frontend**: Express.js, EJS templates, TypeScript, Tailwind CSS
- **Backend**: Express.js, Prisma ORM, PostgreSQL
- **Infrastructure**: Docker, Docker Compose, nginx
- **CI/CD**: GitHub Actions
- **Testing**: Jest, Supertest

## Getting Started

### Prerequisites

- Node.js 20+
- npm (comes with Node.js)
- Docker and Docker Compose (for containerized development)
- PostgreSQL 16 (only if running without Docker)

### Quick Start with Docker (Recommended)

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd sample-app
   ```

2. **Build the Docker images**

   ```bash
   npm run build:local
   ```

3. **Start the application**

   ```bash
   npm run docker:up
   ```

4. **Access the application**
   - Web UI: http://localhost:8080 (Express server with EJS templates)
   - API: http://localhost:3000/api

5. **Stop the application**
   ```bash
   npm run docker:down
   ```

### Local Development Setup

#### Option 1: Docker Compose (Easiest)

```bash
# Build images first (required before first run)
npm run build:local              # Build API, web, and E2E images

# Start all services (postgres, api, web)
npm run docker:up                # Start in foreground
docker-compose up -d             # Start in background

# View logs for all services
npm run docker:logs              # Follow all logs
docker-compose logs -f api       # Follow API logs only
docker-compose logs -f web       # Follow web logs only

# Stop all services
npm run docker:down

# Use specific image version (bypassing npm scripts)
IMAGE_TAG=20250115120000-abc123 docker-compose up
```

The database is automatically migrated and seeded with sample products on startup. The web service runs on port 8080 (mapped from container port 3001).

#### Option 2: Native Development

**Initial Setup:**

```bash
# Install all dependencies
npm install
```

**API Development:**

```bash
cd packages/api

# Set up environment variables
cp .env.example .env
# Edit .env and set DATABASE_URL to your PostgreSQL connection string

# Run database migrations
npx prisma migrate dev

# Seed the database with sample data
npx prisma db seed

# Start the development server
npm run dev
```

The API will run on http://localhost:3000

**Web Development:**

```bash
cd packages/web

# Set up environment variables
cp .env.example .env
# Edit .env and set API_URL=http://localhost:3000

# Start the development server
npm run dev
```

The web UI will run on http://localhost:3001

**Note:** When running with Docker, the web UI is accessible on port 8080. When running locally for development, it runs on port 3001.

### Using the Application

1. **Browse Products**: The home page displays all available chip products
2. **View Details**: Click any product to see detailed information
3. **Add to Cart**: Use the "Add to Cart" button on product cards or detail pages
4. **Manage Cart**:
   - View your cart by clicking the cart icon in the header
   - Adjust quantities using +/- buttons
   - Remove items with the "Delete" button
5. **Checkout**: Click "Proceed to Checkout" to complete your order (demo only - no payment processed)

### Development Commands

#### Root Commands

```bash
npm install                    # Install all workspace dependencies

# Local build commands
npm run build:local            # Build API, web, and E2E images (latest tag)

# Docker compose commands
npm run docker:up              # Start all services (foreground)
npm run docker:down            # Stop all services
npm run docker:logs            # View logs from all services

# E2E testing
npm run docker:test:e2e        # Run E2E tests in Docker against local services
```

#### API Commands (packages/api/)

```bash
npm run dev                    # Start dev server with hot reload
npm run build                  # Build TypeScript to JavaScript
npm start                      # Run production build
npm test                       # Run test suite
npm run test:watch             # Run tests in watch mode
npm run test:coverage          # Run tests with coverage report

# Database commands
npx prisma migrate dev         # Create and apply new migration
npx prisma migrate deploy      # Apply migrations (production)
npx prisma db seed             # Seed database with sample data
npx prisma studio              # Open Prisma Studio GUI
npx prisma generate            # Regenerate Prisma Client
```

#### Web Commands (packages/web/)

```bash
npm run dev                    # Start Express dev server with hot reload
npm run build                  # Build TypeScript to JavaScript
npm start                      # Run production build
npm run lint                   # Run ESLint
```

### Testing

#### Unit Tests

```bash
# Run API tests
npm test

# Run tests with coverage (from packages/api/)
npm run test:coverage
```

#### E2E Tests (Playwright)

**Comprehensive end-to-end tests** using Playwright for both API and browser testing.

**Quick start:**

```bash
# Run all E2E tests locally (requires services running)
npm run test:e2e

# Run E2E tests in Docker against local docker-compose services
npm run build:local         # Build images (first time only, builds all including E2E)
npm run docker:test:e2e     # Run tests

# Run with UI mode (interactive, local only)
npm run test:e2e:ui

# View test report
npm run test:e2e:report
```

**Docker E2E Testing:**

```bash
# Build all images including E2E (local development)
npm run build:local

# Run against local docker-compose services
npm run docker:test:e2e

# Run against remote/deployed services
docker run --rm \
  -e API_URL=https://api.example.com \
  -e WEB_URL=https://www.example.com \
  tonys-chips/e2e:latest

# Save test results locally
docker run --rm \
  -e API_URL=https://api.example.com \
  -e WEB_URL=https://www.example.com \
  -v $(pwd)/test-results:/app/test-results \
  -v $(pwd)/playwright-report:/app/playwright-report \
  tonys-chips/e2e:latest
```

**What's tested:**

**API Tests** (40+ tests):

- ✅ Health checks (2 tests)
- ✅ Product endpoints (5 tests)
- ✅ Cart operations (8 tests)
- ✅ Order processing (4 tests)
- ✅ Session isolation (1 test)
- ✅ CORS and headers (2 tests)
- ✅ Performance (2 tests)

**Web Tests** (30+ tests):

- ✅ Page loading (5 tests)
- ✅ Session management (2 tests)
- ✅ Navigation (2 tests)
- ✅ Product display (2 tests)
- ✅ Cart functionality (2 tests)
- ✅ Form validation (1 test)
- ✅ Responsive design (3 tests)
- ✅ Error handling (2 tests)
- ✅ Performance (2 tests)
- ✅ Accessibility (2 tests)
- ✅ Full user journey (1 test)

**Environment configuration:**

- **Default**: Uses `localhost:3000` (API) and `localhost:8080` (web)
- **Custom**: Set `API_URL` and `WEB_URL` environment variables

**Examples:**

```bash
# Test against staging (local execution)
API_URL=https://api-staging.example.com \
WEB_URL=https://staging.example.com \
npm run test:e2e

# Test against staging (Docker execution)
docker run --rm \
  -e API_URL=https://api-staging.example.com \
  -e WEB_URL=https://staging.example.com \
  tonys-chips/e2e:latest
```

### Building for Production

```bash
# Build Docker images for local development
npm run build:local

# Or build directly with docker
docker build -f docker/api.Dockerfile -t tonys-chips/api:latest .
docker build -f docker/web.Dockerfile -t tonys-chips/web:latest .
docker build -f docker/e2e.Dockerfile -t tonys-chips/e2e:latest .

# Build locally (native)
npm run build --workspace=@chips/api
npm run build --workspace=@chips/web
```

### Database Management

```bash
cd packages/api

# Create a new migration
npx prisma migrate dev --name description_of_changes

# Apply migrations to production
npx prisma migrate deploy

# Reset database (⚠️ deletes all data)
npx prisma migrate reset

# Open Prisma Studio to view/edit data
npx prisma studio
```

### Troubleshooting

**Port already in use:**

```bash
# Check what's running on a port
lsof -i :3000    # API port
lsof -i :3001    # Web dev port
lsof -i :8080    # Web production port

# Kill process using port
kill -9 <PID>
```

**Database connection issues:**

- Ensure PostgreSQL is running (if not using Docker)
- Verify DATABASE_URL in .env file
- Check Docker Compose logs: `npm run docker:logs`

**Prisma Client not found:**

```bash
cd packages/api
npx prisma generate
```

**Module not found errors:**

```bash
# Clean install all dependencies
rm -rf node_modules package-lock.json
rm -rf packages/*/node_modules packages/*/package-lock.json
npm install
```

## Deployment

This application is designed to be deployed on AWS using System Initiative:

- **Compute**: Amazon ECS (Fargate) for containerized services
- **Database**: Amazon RDS (PostgreSQL)
- **Networking**: VPC with public/private subnets, Application Load Balancer
- **Container Registry**: Amazon ECR for Docker images

Container images are tagged with `YYYYMMDDHHMMSS-gitsha` format for versioning.

## CI/CD Pipeline

GitHub Actions automatically:

- Runs API tests against PostgreSQL
- Lints the web application
- Builds both API and web services
- Validates TypeScript compilation

All checks run on pull requests and pushes to main/master branches.

## Project Documentation

- **`spec.md`** - Complete application and deployment specification
- **`implementation-plan.md`** - Detailed development checklist
- **`CLAUDE.md`** - Technical documentation for AI-assisted development

## License

Apache License 2.0 - See [LICENSE](LICENSE) for details.

---

Built to demonstrate the power of System Initiative's infrastructure automation and orchestration capabilities.
