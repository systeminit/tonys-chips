// Set DATABASE_URL before any imports that need Prisma
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/tonys_chips_test';
process.env.NODE_ENV = 'test';

import prisma from '../config/database';

// Setup test database before all tests
beforeAll(async () => {
  // Ensure database is initialized
  await prisma.$connect();
});

// Clean up after all tests
afterAll(async () => {
  // Cleanup test data
  await prisma.cartItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();

  await prisma.$disconnect();
});

// Clean up cart and order data between tests
beforeEach(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.order.deleteMany();
});

// Export for use in tests
export { prisma };
