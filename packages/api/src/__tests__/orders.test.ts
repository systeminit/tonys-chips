import request from 'supertest';
import express from 'express';
import cors from 'cors';
import orderRoutes from '../routes/orders';
import cartRoutes from '../routes/cart';
import { errorHandler } from '../middleware/errorHandler';
import prisma from '../config/database';

// Create test app with both cart and order routes
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use(errorHandler);

describe('Order Endpoints', () => {
  let testProductId: string;
  let testSessionId: string;

  beforeAll(async () => {
    // Create a test product
    const product = await prisma.product.create({
      data: {
        name: 'Order Test Chips',
        brand: 'Test Brand',
        description: 'Test description',
        price: 4.99,
        imageUrl: 'https://example.com/test.jpg',
        stockQuantity: 30,
      },
    });
    testProductId = product.id;
  });

  beforeEach(() => {
    testSessionId = 'test-order-session-' + Date.now();
  });

  describe('POST /api/orders', () => {
    it('should create an order from cart items', async () => {
      // First add items to cart
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: testProductId,
          quantity: 3,
          sessionId: testSessionId,
        });

      // Create order
      const response = await request(app)
        .post('/api/orders')
        .send({ sessionId: testSessionId })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('sessionId', testSessionId);
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body).toHaveProperty('status', 'completed');
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThan(0);

      // Check total calculation
      expect(response.body.totalAmount).toBe(4.99 * 3);

      // Verify cart is cleared
      const cartResponse = await request(app)
        .get(`/api/cart/${testSessionId}`);

      expect(cartResponse.body.length).toBe(0);
    });

    it('should calculate correct total for multiple items', async () => {
      // Create another product
      const product2 = await prisma.product.create({
        data: {
          name: 'Another Test Chips',
          brand: 'Test Brand 2',
          description: 'Test description',
          price: 2.50,
          imageUrl: 'https://example.com/test2.jpg',
          stockQuantity: 15,
        },
      });

      // Add multiple items to cart
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: testProductId,
          quantity: 2,
          sessionId: testSessionId,
        });

      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product2.id,
          quantity: 3,
          sessionId: testSessionId,
        });

      // Create order
      const response = await request(app)
        .post('/api/orders')
        .send({ sessionId: testSessionId })
        .expect(201);

      const expectedTotal = (4.99 * 2) + (2.50 * 3);
      expect(response.body.totalAmount).toBe(expectedTotal);
      expect(response.body.items.length).toBe(2);
    });

    it('should return 400 for missing sessionId', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'sessionId is required');
    });

    it('should return 400 for empty cart', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({ sessionId: 'empty-cart-session' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Cart is empty');
    });

    it('should include product details in order items', async () => {
      // Add item to cart
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: testProductId,
          quantity: 1,
          sessionId: testSessionId,
        });

      // Create order
      const response = await request(app)
        .post('/api/orders')
        .send({ sessionId: testSessionId })
        .expect(201);

      const orderItem = response.body.items[0];
      expect(orderItem).toHaveProperty('productId');
      expect(orderItem).toHaveProperty('productName');
      expect(orderItem).toHaveProperty('brand');
      expect(orderItem).toHaveProperty('price');
      expect(orderItem).toHaveProperty('quantity');
      expect(orderItem).toHaveProperty('subtotal');
    });
  });
});
