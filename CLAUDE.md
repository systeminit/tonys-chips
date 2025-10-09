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
# Build individual images (from root)
docker build -f docker/api.Dockerfile -t tonys-chips-api:test .
docker build -f docker/web.Dockerfile -t tonys-chips-web:test .

# Full stack with Docker Compose
docker-compose up --build    # Build and start all services
docker-compose down          # Stop and remove containers
docker-compose logs <service> # View logs for specific service
```

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
