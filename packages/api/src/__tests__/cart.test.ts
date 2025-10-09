import request from 'supertest';
import express from 'express';
import cors from 'cors';
import cartRoutes from '../routes/cart';
import { errorHandler } from '../middleware/errorHandler';
import prisma from '../config/database';

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/cart', cartRoutes);
app.use(errorHandler);

describe('Cart Endpoints', () => {
  let testProductId: string;
  let testSessionId: string;
  let cartItemId: string;

  beforeAll(async () => {
    // Create a test product
    const product = await prisma.product.create({
      data: {
        name: 'Cart Test Chips',
        brand: 'Test Brand',
        description: 'Test description',
        price: 3.99,
        imageUrl: 'https://example.com/test.jpg',
        stockQuantity: 20,
      },
    });
    testProductId = product.id;
    testSessionId = 'test-session-' + Date.now();
  });

  describe('POST /api/cart/items', () => {
    it('should add a new item to cart', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .send({
          productId: testProductId,
          quantity: 2,
          sessionId: testSessionId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('productId', testProductId);
      expect(response.body).toHaveProperty('quantity', 2);
      expect(response.body).toHaveProperty('sessionId', testSessionId);
      expect(response.body).toHaveProperty('product');

      cartItemId = response.body.id;
    });

    it('should update quantity if item already in cart', async () => {
      // Add item first time
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: testProductId,
          quantity: 1,
          sessionId: testSessionId,
        });

      // Add same item again
      const response = await request(app)
        .post('/api/cart/items')
        .send({
          productId: testProductId,
          quantity: 2,
          sessionId: testSessionId,
        })
        .expect(201);

      expect(response.body.quantity).toBe(3); // 1 + 2
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .send({
          productId: testProductId,
          // missing quantity and sessionId
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid quantity', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .send({
          productId: testProductId,
          quantity: 0,
          sessionId: testSessionId,
        })
        .expect(400);

      expect(response.body.error).toContain('at least 1');
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .send({
          productId: 'non-existent-id',
          quantity: 1,
          sessionId: testSessionId,
        })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Product not found');
    });
  });

  describe('GET /api/cart/:sessionId', () => {
    it('should return cart items for a session', async () => {
      // First add an item
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: testProductId,
          quantity: 3,
          sessionId: testSessionId,
        });

      const response = await request(app)
        .get(`/api/cart/${testSessionId}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('product');
    });

    it('should return empty array for session with no items', async () => {
      const response = await request(app)
        .get('/api/cart/empty-session-123')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('PUT /api/cart/items/:id', () => {
    it('should update cart item quantity', async () => {
      // First add an item
      const addResponse = await request(app)
        .post('/api/cart/items')
        .send({
          productId: testProductId,
          quantity: 1,
          sessionId: testSessionId,
        });

      const itemId = addResponse.body.id;

      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .send({ quantity: 5 })
        .expect(200);

      expect(response.body.quantity).toBe(5);
    });

    it('should return 400 for invalid quantity', async () => {
      const response = await request(app)
        .put(`/api/cart/items/${cartItemId}`)
        .send({ quantity: 0 })
        .expect(400);

      expect(response.body.error).toContain('at least 1');
    });

    it('should return 404 for non-existent cart item', async () => {
      const response = await request(app)
        .put('/api/cart/items/non-existent-id')
        .send({ quantity: 2 })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Cart item not found');
    });
  });

  describe('DELETE /api/cart/items/:id', () => {
    it('should remove cart item', async () => {
      // First add an item
      const addResponse = await request(app)
        .post('/api/cart/items')
        .send({
          productId: testProductId,
          quantity: 1,
          sessionId: testSessionId,
        });

      const itemId = addResponse.body.id;

      await request(app)
        .delete(`/api/cart/items/${itemId}`)
        .expect(204);

      // Verify item is removed
      const getResponse = await request(app)
        .get(`/api/cart/${testSessionId}`);

      const itemStillExists = getResponse.body.some((item: any) => item.id === itemId);
      expect(itemStillExists).toBe(false);
    });

    it('should return 404 for non-existent cart item', async () => {
      const response = await request(app)
        .delete('/api/cart/items/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Cart item not found');
    });
  });
});
