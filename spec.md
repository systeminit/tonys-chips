# Application Description

A web storefront for "Tony's world of chips". It sells various brands of potato chips.

## Overview
The application consists of three tiers:
- **Web Frontend**: React-based single-page application
- **API Layer**: RESTful API built with Express.js
- **Database**: PostgreSQL database for data persistence

All components are written in TypeScript.

## Frontend Stack
- **Framework**: React 18 with Vite for build tooling
- **Routing**: React Router v6
- **Styling**: TailwindCSS
- **HTTP Client**: Axios
- **State Management**: React Context API (or Zustand for more complex state)
- **Build Output**: Static files served via nginx in Docker container

## API Stack
- **Framework**: Express.js with TypeScript
- **Database Client**: Prisma ORM for type-safe database access
- **Validation**: Zod for request validation
- **CORS**: cors middleware for cross-origin requests
- **Environment Config**: dotenv for configuration management

## Data Models
- **Products**: id, name, brand, description, price, imageUrl, stockQuantity
- **CartItems**: id, productId, quantity, sessionId
- **Orders**: id, sessionId, items (JSON), totalAmount, createdAt, status

## Key Features
- **Product Catalog**: Browse available chip brands with images, descriptions, and prices
- **Shopping Cart**: Add/remove items, update quantities, view cart total
- **Session Management**: Cart persistence using session identifiers
- **Checkout**: Convert cart to order (stub only - no payment processing)
- **Inventory Display**: Show stock availability for each product

## API Endpoints
- `GET /api/products` - List all products
- `GET /api/products/:id` - Get product details
- `POST /api/cart/items` - Add item to cart
- `GET /api/cart/:sessionId` - Get cart contents
- `PUT /api/cart/items/:id` - Update cart item quantity
- `DELETE /api/cart/items/:id` - Remove cart item
- `POST /api/orders` - Create order from cart

## User Workflow
1. User visits homepage and sees grid of chip products
2. User clicks on product to view details
3. User adds items to cart (stored by session ID)
4. User views cart and adjusts quantities
5. User proceeds to checkout (creates order record - no payment required)

# Deployment Specification

All deployment is managed by System Initiative.

The web application and the API layer should be packaged into docker containers. 

They should be tagged with a the data and the gitsha as a single version tag every time they are produced - YYYYMMDDHHMMSS-gitsha.

The containers should deploy to AWS ECS with an ECR registry from a github action on every merge to main.

The API layer needs to be configured to talk to a remote postres databse using RDS.

The Web app should be behidn a public load balancer (and in a private subnet).

The API should be behind an internal load balancer (and in a private subnet).

It should be in its own VPC. Each alyer should have its own subnets. They should all be private.

Tehre should be load balancers between the web and api layers.

The web app should be able to route to the API, but not the database layer.

It should include security groups and IAM policies as needed.

