# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Tony's World of Chips", an e-commerce storefront application built as a monorepo with npm workspaces. The application sells potato chips and demonstrates a full-stack TypeScript application with Docker containerization.

## Monorepo Structure

The project uses npm workspaces with two packages:
- `packages/api/` - Express.js REST API with Prisma ORM
- `packages/web/` - Express.js server-side rendered frontend with EJS templates
- `e2e/` - Playwright end-to-end tests (in root directory)

The root `tsconfig.json` is shared by both packages. Each package extends it with package-specific settings.

## Development Commands

### Running Locally

```bash
# API (from packages/api/)
npm run dev          # Start development server on port 3000
npm run build        # Build TypeScript
npm start            # Run production build
npm test             # Run all tests with Jest
npm run test:watch   # Watch mode
npm run test:coverage # With coverage report

# Web (from packages/web/)
npm run dev          # Start development server on port 3001
npm run build        # Build TypeScript
npm start            # Run production build
npm run lint         # Run ESLint

# E2E Tests (from root directory)
npm run test:e2e     # Run Playwright tests
npm run test:e2e:ui  # Run tests with UI
npm run test:e2e:report # Show test report
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

**Entry Point**: `src/index.ts` sets up Express app with middleware (cors, json parser, error handler) and mounts routes. Includes health check endpoints at `/health` and `/health/db` for monitoring.

**Database**: Prisma ORM with PostgreSQL (schema: `prisma/schema.prisma`)
- Models: Product, CartItem, Order
- Database client: `src/config/database.ts` exports singleton Prisma instance with IAM token refresh logic
- Migrations: Auto-applied on container startup in Docker Compose
- Authentication: Supports both password and AWS IAM authentication
  - IAM tokens auto-refresh every 14 minutes (before 15-minute expiry)
  - `src/config/secrets.ts` handles IAM token generation via AWS RDS Signer
  - Controlled by `DB_USE_IAM_AUTH` environment variable

**Route Organization**:
- `src/routes/products.ts` - Product catalog endpoints
- `src/routes/cart.ts` - Shopping cart CRUD operations
- `src/routes/orders.ts` - Order creation (checkout)
- All routes mounted at `/api/*` prefix

**Testing**: Jest with supertest for API integration tests in `src/__tests__/`

**AWS Integration**:
- RDS IAM authentication for database connections in production
- Secrets Manager integration for password-based authentication (fallback)
- Token refresh mechanism ensures long-running connections remain valid

### Web Architecture (packages/web/)

**Server Framework**: Express.js with server-side rendering using EJS templates

**Entry Point**: `src/index.ts` sets up Express app with session management, view engine, and routes

**Routing**: Express router-based routing
- `/` - Home page (product grid)
- `/products/:id` - Product detail page
- `/cart` - Shopping cart page
- `/orders/checkout` - Checkout page
- `/health` - Health check endpoint

**Session Management**: Express-session middleware with Valkey store
- Valkey-backed session storage for multi-instance support (Redis-compatible protocol)
- Sessions persist across server restarts and load-balanced instances
- Generates and persists unique session ID for cart tracking
- Session ID automatically injected into all views via `res.locals`
- Session TTL: 30 days

**Service Layer**: `src/services/` contains API client wrappers
- Axios-based HTTP clients for communicating with the API backend
- Handles all API communication from the web server

**View Templates**: EJS templates in `views/` directory
- `views/home.ejs` - Product listing page
- `views/product-detail.ejs` - Individual product page
- `views/cart.ejs` - Shopping cart view
- `views/checkout.ejs` - Checkout confirmation
- `views/partials/` - Reusable template components (header, footer)

**Static Assets**: Served from `public/` directory, includes Tailwind CSS styling

**Environment Config**:
- `API_URL` - Backend API URL (passed to views for client-side API calls)
- `SESSION_SECRET` - Session encryption key
- `REDIS_URL` - Valkey connection URL (default: redis://localhost:6379, uses Redis-compatible protocol, use AWS ElastiCache Valkey endpoint for production)
- `PORT` - Server port (default: 3001)

### Docker Architecture

**API Container** (`docker/api.Dockerfile`):
- Multi-stage build not used; single stage with Node 20
- Copies root `tsconfig.json` to resolve extends in package tsconfig
- Structure: Mimics monorepo with `/app/packages/api/` inside container
- Prisma Client generated at build time
- Production command: `npm start` (runs compiled JS)

**Web Container** (`docker/web.Dockerfile`):
- Single-stage build with Node 20
- Copies root `tsconfig.json` to resolve extends in package tsconfig
- Structure: Mimics monorepo with `/app/packages/web/` inside container
- Installs dependencies, copies source and views, builds TypeScript
- Production: Runs Express server on port 3001
- Serves EJS-rendered HTML pages with session management

**Docker Compose** (`docker-compose.yml`):
- Four services: postgres, valkey, api, web
- PostgreSQL 16-alpine with health checks and persistent volume
- Valkey 8-alpine with health checks (ephemeral, no persistence, Redis-compatible)
- API waits for healthy postgres, runs migrations + seed on startup
- Web depends on API and healthy Valkey
- Bridge network for inter-container communication
- Port mappings:
  - postgres: 5432 (host) → 5432 (container)
  - valkey: 6379 (host) → 6379 (container)
  - api: 3000 (host) → 3000 (container)
  - web: 8080 (host) → 3001 (container)
- Environment variables:
  - API: `DATABASE_URL`, `PORT`, `NODE_ENV`
  - Web: `API_URL`, `PORT`, `NODE_ENV`, `SESSION_SECRET`, `REDIS_URL`
- Images use `${IMAGE_TAG:-latest}` for flexible versioning

**E2E Test Container** (`docker/e2e.Dockerfile`):
- Based on official Playwright image (v1.56.0-jammy) with browsers pre-installed
- Copies root-level test files and configuration:
  - `e2e/` directory with test specs (api.spec.ts, web.spec.ts)
  - `playwright.config.ts` - test configuration
  - Root `tsconfig.json` for TypeScript compilation
- Environment variables (configurable at runtime):
  - `API_URL` - API base URL (default: http://localhost:3000)
  - `WEB_URL` - Web base URL (default: http://localhost:8080)
  - `CI` - CI mode flag (default: true)
- Default command: `npx playwright test`
- Test projects configured separately for API and web tests

### E2E Testing Architecture

**Framework**: Playwright (v1.56.0) with TypeScript

**Test Organization**:
- `e2e/api.spec.ts` - API endpoint tests (health checks, products, cart, orders)
- `e2e/web.spec.ts` - Web UI tests (browsing, cart interactions, checkout flow)
- Tests run in separate Playwright projects with different base URLs

**Configuration** (`playwright.config.ts`):
- Configurable API and web URLs via environment variables
- Separate test projects for API vs web tests
- CI mode with retries and single worker for stability
- HTML, JSON, and list reporters enabled
- Screenshots and videos captured on failure

**Running Tests**:
- Locally: `npm run test:e2e` (requires running services)
- Docker: `npm run docker:test:e2e` (uses E2E container)
- Against remote environments: Set `API_URL` and `WEB_URL` environment variables

### CI/CD Orchestration

**Entry Point**: `ci/main.ts` - Centralized TypeScript CLI for all CI/CD operations

**Available Commands**:
- `calver` - Generate CALVER timestamp tags from git commit
- `check-postgres` - Verify PostgreSQL service readiness with configurable timeout
- `check-infraflags` - Check infrastructure flags deployment status across environments
- `check-policy` - Run compliance policy checks against System Initiative infrastructure
- `build-local` - Build Docker images with `latest` tag for local development
- `test-e2e` - Run E2E tests in Docker container
- `manage-image-lifecycle` - Unified image lifecycle management (build/publish/deploy)
- `manage-stack-lifecycle` - Manage System Initiative stack operations (up/down)
- `post-to-pr` - Post various content to GitHub pull requests

**Usage**: All commands are accessible via `npx tsx ci/main.ts <command> [args]` or through npm scripts like `npm run ci:<command>`

**GitHub Actions Integration**: Commands are designed for use in CI/CD pipelines with proper error handling and exit codes

### Database Schema Considerations

The Prisma schema (`packages/api/prisma/schema.prisma`) currently uses `provider = "postgresql"` for Docker/production. If switching between PostgreSQL and SQLite for local development, migrations must be regenerated due to provider mismatch errors (P3019). Remove `packages/api/prisma/migrations/` and re-run `prisma migrate dev` when switching providers.

## Deployment

**Container Tagging**: Images should be tagged with `YYYYMMDDHHMMSS-gitsha` format (CALVER) for production deployment.

**Target**: AWS ECS with RDS PostgreSQL backend via RDS Proxy (see `spec.md` and `INFRA.md` for architecture details).

**Environment Variables**:

API Container:
- `DATABASE_URL` - PostgreSQL connection string (optional if using IAM)
- `DB_USE_IAM_AUTH` - Enable IAM authentication (true/false)
- `DB_HOST` - RDS Proxy endpoint hostname
- `DB_PORT` - Database port (default: 5432)
- `DB_USER` - Database username
- `DB_SECRET_ARN` - Secrets Manager ARN (for password auth)
- `AWS_REGION` - AWS region for services
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (production/development)

Web Container:
- `API_URL` - Backend API URL (e.g., http://api:3000 for Docker, https://api.example.com for production)
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment mode
- `SESSION_SECRET` - Session encryption key (must be set in production)
- `REDIS_URL` - Valkey connection URL (use AWS ElastiCache Valkey endpoint for production, e.g., redis://valkey-endpoint:6379, uses Redis-compatible protocol)

## Key Files

- `spec.md` - Original application specification
- `INFRA.md` - Infrastructure architecture and AWS service details
- `README.md` - Project overview and getting started guide
- `docker-compose.yml` - Local full-stack orchestration
- `packages/api/prisma/schema.prisma` - Database schema (Product, CartItem, Order models)
- `packages/api/src/config/database.ts` - Prisma client with IAM token refresh logic
- `packages/api/src/config/secrets.ts` - AWS IAM auth and Secrets Manager integration
- `packages/web/src/index.ts` - Web server entry point with session management
- `packages/web/views/` - EJS templates for server-side rendering
- `e2e/` - Playwright end-to-end tests (api.spec.ts, web.spec.ts)
- `playwright.config.ts` - E2E test configuration
- `ci/main.ts` - CI orchestration entry point for build, test, and deployment commands
- `infraflags.yaml` - Infrastructure feature flags
- `policy/` - Compliance policy definitions for System Initiative validation
