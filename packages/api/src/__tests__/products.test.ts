import request from 'supertest';
import express from 'express';
import cors from 'cors';
import productRoutes from '../routes/products';
import { errorHandler } from '../middleware/errorHandler';
import { prisma } from './setup';

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/products', productRoutes);
app.use(errorHandler);

describe('Product Endpoints', () => {
  let testProductId: string;

  beforeAll(async () => {
    // Create a test product
    const product = await prisma.product.create({
      data: {
        name: 'Test Chips',
        brand: 'Test Brand',
        description: 'Test description',
        price: 2.99,
        imageUrl: 'https://example.com/test.jpg',
        stockQuantity: 10,
      },
    });
    testProductId = product.id;
  });

  describe('GET /api/products', () => {
    it('should return all products', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('brand');
      expect(response.body[0]).toHaveProperty('price');
    });

    it('should return products ordered by brand', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      // Check that products are ordered
      const brands = response.body.map((p: any) => p.brand);
      const sortedBrands = [...brands].sort();
      expect(brands).toEqual(sortedBrands);
    });
  });

  describe('GET /api/products/:id', () => {
    it('should return a single product by id', async () => {
      const response = await request(app)
        .get(`/api/products/${testProductId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testProductId);
      expect(response.body).toHaveProperty('name', 'Test Chips');
      expect(response.body).toHaveProperty('brand', 'Test Brand');
      expect(response.body).toHaveProperty('price', 2.99);
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/api/products/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Product not found');
    });
  });
});
