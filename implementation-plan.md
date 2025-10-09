# Implementation Plan: Tony's World of Chips

## Current Status
- **Current Phase**: Phase 5 - Docker Containerization
- **Last Completed**: Phase 5.3 - Docker Compose (Full stack running successfully)
- **Next Task**: Phase 6 - Build & Deployment Preparation

**Note**: Phase 4 (Frontend Development) has been completed successfully. The React application is fully functional with all components, pages, routing, state management, and API integration. Both API and web servers are running:
- API Server: http://localhost:3000 (12 products seeded)
- Web Server: http://localhost:5173

Going forward, tests should be written and run between major development phases to ensure code quality and catch issues early.

---

## Phase 1: Project Structure Setup

### 1.1 Initialize Root Workspace
- [ ] Create `package.json` in project root with workspaces configuration
  - Command: `npm init -y`
  - Edit package.json to add: `"workspaces": ["packages/*"]`
  - **Verification**: File exists at `/home/adam/src/sample-app/package.json` with workspaces field

- [ ] Create `tsconfig.json` in project root for shared TypeScript config
  - **Verification**: File exists and contains compiler options

- [ ] Create directory structure
  - Command: `mkdir -p packages/api packages/web docker`
  - **Verification**: All three directories exist

### 1.2 Initialize API Package
**Requires**: Phase 1.1 complete

- [ ] Create `packages/api/package.json`
  - Command: `cd packages/api && npm init -y`
  - Set name to `@chips/api`
  - **Verification**: File exists at `packages/api/package.json`

- [ ] Install API dependencies
  - Command: `npm install express cors dotenv prisma @prisma/client`
  - Command: `npm install -D typescript @types/node @types/express @types/cors tsx nodemon`
  - **Verification**: `node_modules` folder created, packages in package.json

- [ ] Create `packages/api/tsconfig.json`
  - Extend from root tsconfig
  - **Verification**: File compiles TypeScript without errors

- [ ] Create `packages/api/src/index.ts` with basic Express server
  - **Verification**: Can run `npm run dev` and see "Server listening on port 3000"

- [ ] Create `packages/api/.env.example` with DATABASE_URL and PORT
  - **Verification**: File exists with template values

### 1.3 Initialize Web Package
**Requires**: Phase 1.1 complete

- [ ] Create Vite + React + TypeScript project in `packages/web`
  - Command: `npm create vite@latest packages/web -- --template react-ts`
  - **Verification**: Vite project structure created

- [ ] Install web dependencies
  - Command: `cd packages/web && npm install react-router-dom axios`
  - Command: `npm install -D tailwindcss postcss autoprefixer`
  - **Verification**: Dependencies in package.json

- [ ] Initialize TailwindCSS
  - Command: `npx tailwindcss init -p`
  - Configure `tailwind.config.js` with content paths
  - Add Tailwind directives to `src/index.css`
  - **Verification**: Tailwind classes work in components

- [ ] Verify web app runs
  - Command: `npm run dev`
  - **Verification**: App accessible at http://localhost:5173

---

## Phase 2: Database Setup

### 2.1 Prisma Initialization
**Requires**: Phase 1.2 complete

- [ ] Initialize Prisma in API package
  - Command: `cd packages/api && npx prisma init`
  - **Verification**: `packages/api/prisma/schema.prisma` created

- [ ] Create Product model in `packages/api/prisma/schema.prisma`
  - Fields: id (String/UUID), name, brand, description, price (Decimal), imageUrl, stockQuantity (Int)
  - **Verification**: Schema has Product model with all fields

- [ ] Create CartItem model in `packages/api/prisma/schema.prisma`
  - Fields: id, productId (relation), quantity, sessionId
  - **Verification**: Schema has CartItem model with Product relation

- [ ] Create Order model in `packages/api/prisma/schema.prisma`
  - Fields: id, sessionId, items (Json), totalAmount (Decimal), createdAt, status
  - **Verification**: Schema has Order model with all fields

### 2.2 Database Migrations & Seeding
**Requires**: Phase 2.1 complete

- [ ] Generate Prisma migration
  - Command: `npx prisma migrate dev --name init`
  - **Verification**: Migration file created in `packages/api/prisma/migrations/`

- [ ] Create `packages/api/prisma/seed.ts`
  - Add 10+ chip products (Lay's Classic, Pringles Original, Kettle Brand Sea Salt, etc.)
  - **Verification**: File exists with product data

- [ ] Add seed script to `packages/api/package.json`
  - Add: `"prisma": { "seed": "tsx prisma/seed.ts" }`
  - **Verification**: Entry exists in package.json

- [ ] Run seed script
  - Command: `npx prisma db seed`
  - **Verification**: Query database and see products: `npx prisma studio` or check with SQL

---

## Phase 3: API Development

### 3.1 Express Server Configuration
**Requires**: Phase 2.2 complete

- [ ] Create `packages/api/src/config/database.ts`
  - Initialize and export Prisma Client
  - **Verification**: File exports working Prisma client

- [ ] Create `packages/api/src/middleware/errorHandler.ts`
  - Global error handling middleware
  - **Verification**: Middleware catches and formats errors

- [ ] Configure Express app in `packages/api/src/index.ts`
  - Add cors middleware
  - Add express.json() middleware
  - Add error handler
  - **Verification**: Server starts without errors, CORS headers present

- [ ] Create `packages/api/src/types/` directory for shared types
  - **Verification**: Directory exists

### 3.2 Product Endpoints
**Requires**: Phase 3.1 complete

- [ ] Create `packages/api/src/routes/products.ts`
  - **Verification**: File exists

- [ ] Implement `GET /api/products` endpoint
  - Return all products from database
  - **Verification**: `curl http://localhost:3000/api/products` returns product array

- [ ] Implement `GET /api/products/:id` endpoint
  - Return single product or 404
  - **Verification**: `curl http://localhost:3000/api/products/{id}` returns product object

- [ ] Mount product routes in `packages/api/src/index.ts`
  - **Verification**: Both endpoints accessible

### 3.3 Cart Endpoints
**Requires**: Phase 3.1 complete

- [ ] Create `packages/api/src/routes/cart.ts`
  - **Verification**: File exists

- [ ] Implement `POST /api/cart/items` endpoint
  - Accept: productId, quantity, sessionId
  - Create or update cart item
  - **Verification**: Can add item to cart via curl/Postman

- [ ] Implement `GET /api/cart/:sessionId` endpoint
  - Return all cart items for session with product details
  - **Verification**: Returns cart items array

- [ ] Implement `PUT /api/cart/items/:id` endpoint
  - Update cart item quantity
  - **Verification**: Can update quantity via curl/Postman

- [ ] Implement `DELETE /api/cart/items/:id` endpoint
  - Remove cart item
  - **Verification**: Item removed from database

- [ ] Mount cart routes in `packages/api/src/index.ts`
  - **Verification**: All cart endpoints accessible

### 3.4 Order Endpoint
**Requires**: Phase 3.3 complete

- [ ] Create `packages/api/src/routes/orders.ts`
  - **Verification**: File exists

- [ ] Implement `POST /api/orders` endpoint (checkout stub)
  - Accept: sessionId
  - Fetch cart items, calculate total, create order record
  - Clear cart items for session
  - Return order confirmation
  - **Verification**: Creates order in database, clears cart

- [ ] Mount order routes in `packages/api/src/index.ts`
  - **Verification**: Order endpoint accessible

### 3.5 Request Validation (Optional but Recommended)
**Requires**: Phase 3.1 complete

- [ ] Install Zod
  - Command: `cd packages/api && npm install zod`
  - **Verification**: Package in package.json

- [ ] Create `packages/api/src/validators/` directory
  - **Verification**: Directory exists

- [ ] Create validation schemas for cart and order requests
  - **Verification**: Schemas validate correct input, reject invalid input

- [ ] Add validation middleware to routes
  - **Verification**: Invalid requests return 400 errors

---

## Phase 3.6: API Testing ✅
**Requires**: Phase 3.4 complete

- [x] Install testing dependencies
  - Command: `npm install -D jest @types/jest ts-jest supertest @types/supertest --workspace=@chips/api`
  - **Verification**: Dependencies in package.json ✓

- [x] Create `packages/api/jest.config.js`
  - Configure ts-jest preset
  - **Verification**: File exists with proper configuration ✓

- [x] Create `packages/api/src/__tests__/setup.ts`
  - Setup database connection and cleanup
  - **Verification**: Setup file clears test data properly ✓

- [x] Write tests for product endpoints
  - Create `packages/api/src/__tests__/products.test.ts`
  - Test GET /api/products and GET /api/products/:id
  - **Verification**: All product tests pass (4/4) ✓

- [x] Write tests for cart endpoints
  - Create `packages/api/src/__tests__/cart.test.ts`
  - Test POST, GET, PUT, DELETE for cart items
  - **Verification**: All cart tests pass (13/13) ✓

- [x] Write tests for order endpoint
  - Create `packages/api/src/__tests__/orders.test.ts`
  - Test POST /api/orders (checkout)
  - **Verification**: All order tests pass (4/4) ✓

- [x] Run all tests
  - Command: `npm test --workspace=@chips/api`
  - **Verification**: All tests pass (21/21) ✓

- [x] Add test scripts to package.json
  - Add `test`, `test:watch`, `test:coverage` scripts
  - **Verification**: Scripts work correctly ✓

- [x] Configure Prisma logging for clean test output
  - Suppress query logs during tests (NODE_ENV=test)
  - **Verification**: Tests run without verbose console output ✓

---

## Phase 4: Frontend Development

### 4.1 React App Structure
**Requires**: Phase 1.3 complete

- [ ] Create `packages/web/src/config/api.ts`
  - Configure Axios instance with base URL (from env variable)
  - **Verification**: Can import and use API client

- [ ] Create `packages/web/.env.example`
  - Add: `VITE_API_URL=http://localhost:3000`
  - **Verification**: File exists

- [ ] Setup React Router in `packages/web/src/main.tsx`
  - Wrap App with BrowserRouter
  - **Verification**: Router working

- [ ] Create directory structure
  - Command: `mkdir -p packages/web/src/{components,pages,context,services,types}`
  - **Verification**: All directories exist

### 4.2 API Service Layer
**Requires**: Phase 4.1 complete

- [ ] Create `packages/web/src/services/productService.ts`
  - Functions: getProducts(), getProduct(id)
  - **Verification**: Can fetch products from API

- [ ] Create `packages/web/src/services/cartService.ts`
  - Functions: getCart(), addToCart(), updateCartItem(), removeFromCart()
  - **Verification**: Can interact with cart API

- [ ] Create `packages/web/src/services/orderService.ts`
  - Function: createOrder()
  - **Verification**: Can create orders

- [ ] Create `packages/web/src/types/index.ts`
  - Define types for Product, CartItem, Order
  - **Verification**: Types available throughout app

### 4.3 State Management
**Requires**: Phase 4.2 complete

- [ ] Create `packages/web/src/context/CartContext.tsx`
  - Manage cart state, session ID
  - Provide cart actions (add, update, remove, checkout)
  - **Verification**: Context provides cart state and actions

- [ ] Generate and persist session ID in localStorage
  - Generate UUID on first visit
  - **Verification**: Session ID persists across page refreshes

- [ ] Wrap App with CartProvider in `packages/web/src/main.tsx`
  - **Verification**: Cart context accessible in components

### 4.4 Core Components
**Requires**: Phase 4.3 complete

- [ ] Create `packages/web/src/components/Layout.tsx`
  - Header with site name and cart link
  - Navigation
  - Outlet for child routes
  - **Verification**: Layout renders with header

- [ ] Create `packages/web/src/components/ProductCard.tsx`
  - Display: image, name, brand, price, stock
  - "Add to Cart" button
  - **Verification**: Card renders product data nicely

- [ ] Create `packages/web/src/components/ProductGrid.tsx`
  - Display grid of ProductCard components
  - **Verification**: Grid displays multiple products

- [ ] Create `packages/web/src/components/CartItem.tsx`
  - Display cart item with product info
  - Quantity controls (increment/decrement)
  - Remove button
  - **Verification**: Cart item shows product and controls work

- [ ] Create `packages/web/src/components/Cart.tsx`
  - List of CartItem components
  - Total price calculation
  - Checkout button
  - **Verification**: Cart displays all items and total

### 4.5 Pages & Routes
**Requires**: Phase 4.4 complete

- [ ] Create `packages/web/src/pages/HomePage.tsx`
  - Fetch and display products in ProductGrid
  - **Verification**: Home page shows product grid

- [ ] Create `packages/web/src/pages/ProductDetailPage.tsx`
  - Fetch single product by ID
  - Display full product details
  - Add to cart functionality
  - **Verification**: Product detail page loads and shows data

- [ ] Create `packages/web/src/pages/CartPage.tsx`
  - Display Cart component
  - Link to checkout
  - **Verification**: Cart page shows cart items

- [ ] Create `packages/web/src/pages/CheckoutPage.tsx`
  - Order confirmation (stub, no payment)
  - Display order summary
  - **Verification**: Checkout creates order and shows confirmation

- [ ] Configure routes in `packages/web/src/App.tsx`
  - `/` → HomePage
  - `/products/:id` → ProductDetailPage
  - `/cart` → CartPage
  - `/checkout` → CheckoutPage
  - **Verification**: All routes navigate correctly

### 4.6 Integration & Polish
**Requires**: Phase 4.5 complete

- [ ] Test complete user flow
  - Browse products → View detail → Add to cart → View cart → Checkout
  - **Verification**: Full flow works end-to-end

- [ ] Add loading states to components
  - **Verification**: Loading indicators show during API calls

- [ ] Add error handling and user feedback
  - **Verification**: Errors display to user gracefully

- [ ] Style components with Tailwind
  - **Verification**: App looks presentable

---

## Phase 5: Docker Containerization

### 5.1 API Container ✅
**Requires**: Phase 3.4 complete

- [x] Create `docker/api.Dockerfile`
  - Base: node:20-slim
  - Mimics monorepo structure (copies root tsconfig.json)
  - Install deps, copy source, build TypeScript
  - Run Prisma generate
  - Expose port 3000
  - CMD: start server
  - **Verification**: File exists at docker/api.Dockerfile ✓

- [x] Create `packages/api/.dockerignore`
  - Ignore node_modules, .env, dist
  - **Verification**: File exists ✓

- [x] Build API Docker image
  - Command: `docker build -f docker/api.Dockerfile -t tonys-chips-api:test .` (build from root context)
  - **Verification**: Image builds successfully ✓

- [x] Test API container locally
  - Command: `docker run -p 3002:3000 --env-file packages/api/.env tonys-chips-api:test`
  - **Verification**: Container runs, server starts on port 3000 ✓
  - Note: Database connectivity will be configured with Docker Compose in Phase 5.3

### 5.2 Web Container ✅
**Requires**: Phase 4.6 complete

- [x] Create `docker/web.Dockerfile` (multi-stage)
  - Stage 1: Build React app with Node
  - Stage 2: Serve with nginx
  - Copy build output to nginx html directory
  - Configure nginx for SPA routing
  - Expose port 80
  - **Verification**: File exists at docker/web.Dockerfile ✓

- [x] Create `docker/nginx.conf`
  - Configure try_files for SPA routing
  - Cache static assets, disable cache for index.html
  - Enable gzip compression
  - **Verification**: File exists ✓

- [x] Create `packages/web/.dockerignore`
  - Ignore node_modules, dist
  - **Verification**: File exists ✓

- [x] Build web Docker image
  - Command: `docker build -f docker/web.Dockerfile -t tonys-chips-web:test .` (build from root context)
  - **Verification**: Image builds successfully ✓

- [x] Test web container locally
  - Command: `docker run -p 8080:80 tonys-chips-web:test`
  - **Verification**: Container runs, app accessible at localhost:8080, SPA routing works ✓

### 5.3 Docker Compose for Local Testing ✅
**Requires**: Phase 5.2 complete

- [x] Create `docker-compose.yml` in project root
  - Services: postgres (PostgreSQL 16), api, web
  - Configure networking with bridge network
  - Set environment variables
  - Health checks for postgres
  - **Verification**: File exists ✓

- [x] Update Prisma schema from SQLite to PostgreSQL
  - Changed provider to `postgresql`
  - Removed old SQLite migrations
  - **Verification**: Schema updated ✓

- [x] Test full stack with Docker Compose
  - Command: `docker-compose up --build`
  - **Verification**: All three services start and communicate ✓
  - API accessible at http://localhost:3000
  - Web accessible at http://localhost:8080
  - Database accessible at localhost:5432

- [x] Test database migrations in container
  - Migrations auto-create and apply on startup
  - Database seeded with 12 products
  - **Verification**: Prisma migrations run successfully, API returns data ✓

---

## Phase 6: Build & Deployment Preparation

### 6.1 Build Scripts & Tagging
**Requires**: Phase 5.3 complete

- [ ] Create `scripts/build.sh`
  - Generate version tag: `YYYYMMDDHHMMSS-gitsha`
  - Build and tag both Docker images
  - **Verification**: Script generates correct tags

- [ ] Make script executable
  - Command: `chmod +x scripts/build.sh`
  - **Verification**: Script runs without permission errors

- [ ] Test build script
  - Command: `./scripts/build.sh`
  - **Verification**: Images tagged with timestamp and git SHA

### 6.2 Documentation for Deployment
**Requires**: Phase 6.1 complete

- [ ] Create `DEPLOYMENT.md`
  - Document environment variables needed
  - Document ECS deployment steps
  - Document RDS connection setup
  - Network architecture diagram (text-based)
  - **Verification**: File exists with complete info

- [ ] Create environment variable templates
  - `packages/api/.env.production.example`
  - `packages/web/.env.production.example`
  - **Verification**: Templates exist with all required variables

---

## Phase 7: Documentation & Final Testing

### 7.1 Project Documentation
**Requires**: Phase 6.2 complete

- [ ] Create `README.md` in project root
  - Project overview
  - Local development setup
  - Running with Docker
  - Architecture overview
  - **Verification**: README is clear and complete

- [ ] Create `packages/api/README.md`
  - API endpoints documentation
  - Request/response examples
  - **Verification**: API docs complete

- [ ] Document database schema
  - Can be in API README or separate file
  - **Verification**: Schema documented

### 7.2 Final Testing (Optional)
**Requires**: Phase 7.1 complete

- [ ] Manual test all API endpoints
  - **Verification**: All endpoints work as expected

- [ ] Manual test all user flows
  - **Verification**: Complete user journey works

- [ ] Test Docker containers on clean system
  - **Verification**: Containers work without local dependencies

---

## Quick Reference

### Key Commands
```bash
# Install dependencies (root)
npm install

# Run API locally
cd packages/api && npm run dev

# Run Web locally
cd packages/web && npm run dev

# Run Prisma Studio
cd packages/api && npx prisma studio

# Build Docker images
./scripts/build.sh

# Run full stack
docker-compose up
```

### Important Files
- `spec.md` - Application specification
- `implementation-plan.md` - This file
- `packages/api/prisma/schema.prisma` - Database schema
- `packages/api/src/index.ts` - API entry point
- `packages/web/src/App.tsx` - Frontend routing
- `docker-compose.yml` - Local development stack
