# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Tony's World of Chips", an e-commerce storefront application built as a monorepo with npm workspaces. The application sells potato chips and demonstrates a full-stack TypeScript application with Docker containerization.

## Monorepo Structure

The project uses npm workspaces with two packages:
- `packages/api/` - Express.js REST API with Prisma ORM
- `packages/web/` - React SPA with Vite

The root `tsconfig.json` is shared by both packages. Each package extends it with package-specific settings.

## Development Commands

### Running Locally

```bash
# API (from packages/api/)
npm run dev          # Start development server on port 3000
npm run build        # Build TypeScript
npm start            # Run production build

# Web (from packages/web/)
npm run dev          # Start Vite dev server on port 5173
npm run build        # Build for production
npm run lint         # Run ESLint

# API Tests (from packages/api/)
npm test             # Run all tests with Jest
npm run test:watch   # Watch mode
npm run test:coverage # With coverage report
```

### Database Commands (from packages/api/)

```bash
npx prisma migrate dev --name <name>  # Create and apply migration
npx prisma migrate deploy              # Apply migrations in production
npx prisma db seed                     # Seed database
npx prisma studio                      # Open Prisma Studio GUI
npx prisma generate                    # Generate Prisma Client
```

### Docker Commands

```bash
# Local build commands (uses CI orchestration)
npm run build:local          # Build API, web, and E2E images with latest tag

# CI npm scripts (for use in GitHub Actions or manual deployment)
npm run ci:manage-image-lifecycle  # Unified image lifecycle management

# Or use CI commands directly for granular control
npx tsx ci/main.ts build-local all    # Build all images (api + web + e2e)
npx tsx ci/main.ts build-local api    # Build only API image
npx tsx ci/main.ts build-local web    # Build only web image
npx tsx ci/main.ts build-local e2e    # Build only E2E test image

# Image Lifecycle Management Commands (CI/Deployment with specific tags)
npx tsx ci/main.ts manage-image-lifecycle build <environment> <component> <tag>    # Build only
npx tsx ci/main.ts manage-image-lifecycle publish <environment> <component> <tag>  # Publish only
npx tsx ci/main.ts manage-image-lifecycle deploy <environment> <tag>   # Deploy all components

# Docker Compose orchestration (direct docker-compose commands)
npm run docker:up            # Start services using latest tag (foreground)
npm run docker:down          # Stop and remove containers
npm run docker:logs          # View logs for all services

# Or use docker-compose directly
docker-compose up            # Start services (foreground)
docker-compose up -d         # Start services (background)
docker-compose down          # Stop and remove containers
docker-compose logs -f       # View all logs
docker-compose logs -f api   # View API logs only

# Use specific image tag (for remote deployment or versioned testing)
IMAGE_TAG=20250115120000-abc123 docker-compose up
IMAGE_TAG=20250115120000-abc123 docker-compose up -d
```

### E2E Testing with Docker

The E2E tests can be run in a Docker container for consistent execution across environments:

```bash
# Build all images including E2E (local development)
npm run build:local
# Or build E2E only: npx tsx ci/main.ts build-local e2e

# Build E2E image for CI/deployment with specific tag
npx tsx ci/main.ts build sandbox e2e 20250115120000-abc123

# Run E2E tests against local docker-compose services
npm run docker:test:e2e
# Or: npx tsx ci/main.ts test-e2e

# Run against remote services by setting environment variables
API_URL=https://api.example.com WEB_URL=https://www.example.com npm run docker:test:e2e
# Or: API_URL=https://api.example.com WEB_URL=https://www.example.com npx tsx ci/main.ts test-e2e

# Run directly with docker for custom options (save test results)
docker run --rm \
  -e API_URL=https://api.example.com \
  -e WEB_URL=https://www.example.com \
  -v $(pwd)/test-results:/app/test-results \
  -v $(pwd)/playwright-report:/app/playwright-report \
  tonys-chips/e2e:latest
```

**Environment Variables for E2E Container**:
- `API_URL` - Base URL for the API (default: http://localhost:3000)
- `WEB_URL` - Base URL for the web application (default: http://localhost:8080)
- `CI` - Set to "true" to enable CI mode (enabled by default in container)

### Policy Checking

The project includes an integrated policy compliance checker that evaluates System Initiative infrastructure against defined policies using Claude AI.

**Policy Structure**: Policy files are markdown documents in the `policy/` directory with a specific format:

```markdown
# Policy Title

## Policy
Policy description and requirements...

### Exceptions
Any exceptions to the policy...

## Source Data

### System Initiative
```yaml
query-name: "schema:AWS*"
another-query: "schema:AWS::EC2::*"
```

## Output Tags
```yaml
tags:
  - tag1
  - tag2
```
```

**Running Policy Checks Locally**:

```bash
# Check a single policy
npx tsx ci/main.ts check-policy policy/my-policy.md

# Check with custom output path
npx tsx ci/main.ts check-policy policy/my-policy.md --output ./reports/my-policy-report.md

# Or use npm script
npm run ci:check-policy policy/my-policy.md
```

**Environment Variables**:
- `SI_API_TOKEN` - System Initiative API token (required)
- `SI_WORKSPACE_ID` - System Initiative workspace ID (required)
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude agent (required)
- `GITHUB_TOKEN` - GitHub token for posting issues (optional, for CI)
- `GITHUB_REPOSITORY` - GitHub repository (optional, for CI)

**GitHub Actions Workflow**:

The repository includes a `policy-check.yml` workflow that can be manually triggered to check all policies in the `policy/` directory. The workflow:

1. Discovers all `.md` files in `policy/`
2. Runs each policy check in a matrix build
3. Posts results to GitHub issues (one issue per policy)
4. Closes previous issues for the same policy when creating new ones
5. Uploads reports as artifacts

To trigger manually:
1. Go to Actions tab in GitHub
2. Select "Policy Check" workflow
3. Click "Run workflow"

**How It Works**:

The policy checker runs a 4-stage pipeline:

1. **Extract Policy** - Claude agent parses the policy markdown and extracts structured data
2. **Collect Source Data** - Queries System Initiative API for components matching the policy's source data queries
3. **Evaluate Policy** - Claude agent evaluates each component against policy requirements and identifies failures
4. **Generate Report** - Creates a markdown report with deep links to System Initiative components

Reports include:
- Pass/Fail status
- Summary of evaluation
- Table of failing components with reasons
- Source data tables with policy-relevant attributes
- Deep links to components in System Initiative

## Architecture

### Monorepo and TypeScript Setup
- **Root TypeScript Config**: `tsconfig.json` contains shared compiler options
- **Package Extension**: Both `packages/api/tsconfig.json` and `packages/web/tsconfig.json` extend from root using `"extends": "../../tsconfig.json"`
- **Docker Consideration**: When building Docker images, the root `tsconfig.json` must be copied into the container context to resolve the extends path

### API Architecture (packages/api/)

**Entry Point**: `src/index.ts` sets up Express app with middleware (cors, json parser, error handler) and mounts routes.

**Database**: Prisma ORM with PostgreSQL (schema: `prisma/schema.prisma`)
- Models: Product, CartItem, Order
- Database client: `src/config/database.ts` exports singleton Prisma instance
- Migrations: Auto-applied on container startup in Docker Compose

**Route Organization**:
- `src/routes/products.ts` - Product catalog endpoints
- `src/routes/cart.ts` - Shopping cart CRUD operations
- `src/routes/orders.ts` - Order creation (checkout)
- All routes mounted at `/api/*` prefix

**Testing**: Jest with supertest for API integration tests in `src/__tests__/`

### Web Architecture (packages/web/)

**Build Tool**: Vite with React 19 and TypeScript

**Routing**: React Router v6 setup in `src/App.tsx`
- `/` - Home page (product grid)
- `/products/:id` - Product detail page
- `/cart` - Shopping cart page
- `/checkout` - Checkout confirmation page

**State Management**: React Context API in `src/context/CartContext.tsx`
- Manages cart state globally
- Generates and persists session ID in localStorage
- Provides cart actions: add, update, remove, checkout

**Service Layer**: `src/services/` contains API client wrappers
- `api.ts` - Axios instance configured with base URL from env
- `productService.ts` - Product API calls
- `cartService.ts` - Cart API calls
- `orderService.ts` - Order API calls

**Components**: Organized in `src/components/` with reusable UI components and `src/pages/` for page-level components

**Environment Config**: Uses Vite's `import.meta.env.VITE_API_URL` for API base URL

### Docker Architecture

**API Container** (`docker/api.Dockerfile`):
- Multi-stage build not used; single stage with Node 20
- Copies root `tsconfig.json` to resolve extends in package tsconfig
- Structure: Mimics monorepo with `/app/packages/api/` inside container
- Prisma Client generated at build time
- Production command: `npm start` (runs compiled JS)

**Web Container** (`docker/web.Dockerfile`):
- Multi-stage build: Stage 1 builds React app with Node, Stage 2 serves with nginx
- Accepts `VITE_API_URL` as build argument (baked into build)
- Custom nginx config (`docker/nginx.conf`) handles SPA routing with `try_files`
- Production: Serves static files on port 80

**Docker Compose** (`docker-compose.yml`):
- Three services: postgres, api, web
- PostgreSQL 16 with health checks
- API waits for healthy postgres, runs migrations + seed on startup
- Web depends on API
- Bridge network for inter-container communication
- Ports: postgres:5432, api:3000, web:8080

**E2E Test Container** (`docker/e2e.Dockerfile`):
- Based on official Playwright image with browsers pre-installed
- Single-stage build with Node 20
- Copies only test files and configuration (not full monorepo)
- Accepts environment variables at runtime: `API_URL`, `WEB_URL`, `CI`
- Default command runs all Playwright tests
- Can be customized with different Playwright CLI options

### Database Schema Considerations

The Prisma schema (`packages/api/prisma/schema.prisma`) currently uses `provider = "postgresql"` for Docker/production. If switching between PostgreSQL and SQLite for local development, migrations must be regenerated due to provider mismatch errors (P3019). Remove `packages/api/prisma/migrations/` and re-run `prisma migrate dev` when switching providers.

## Deployment

**Container Tagging**: Images should be tagged with `YYYYMMDDHHMMSS-gitsha` format for production deployment.

**Target**: AWS ECS with RDS PostgreSQL backend (see `spec.md` for network architecture details).

**Environment Variables**:
- API: `DATABASE_URL` (PostgreSQL connection string), `PORT`, `NODE_ENV`
- Web: `VITE_API_URL` (set at build time as Docker ARG)

## Key Files

- `spec.md` - Full application and deployment specification
- `implementation-plan.md` - Detailed development checklist (tracks progress)
- `docker-compose.yml` - Local full-stack orchestration
- `packages/api/prisma/schema.prisma` - Database schema
- `packages/web/src/context/CartContext.tsx` - Global cart state management
