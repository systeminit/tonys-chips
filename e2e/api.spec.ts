import { test, expect } from '@playwright/test';

/**
 * API Smoke Tests
 * Tests the API via HTTP requests (no browser needed)
 */

test.describe('API Health', () => {
  test('should respond to health check endpoint', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  test('should return JSON content-type', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.headers()['content-type']).toContain('application/json');
  });
});

test.describe('Product Endpoints', () => {
  test('should list all products', async ({ request }) => {
    const response = await request.get('/api/products');
    expect(response.ok()).toBeTruthy();

    const products = await response.json();
    expect(Array.isArray(products)).toBeTruthy();
    expect(products.length).toBeGreaterThan(0);
  });

  test('should return products with required fields', async ({ request }) => {
    const response = await request.get('/api/products');
    const products = await response.json();
    const product = products[0];

    expect(product).toHaveProperty('id');
    expect(product).toHaveProperty('name');
    expect(product).toHaveProperty('brand');
    expect(product).toHaveProperty('price');
    expect(product).toHaveProperty('imageUrl');
    expect(product).toHaveProperty('stockQuantity');
  });

  test('should return products ordered by brand', async ({ request }) => {
    const response = await request.get('/api/products');
    const products = await response.json();

    const brands = products.map((p: any) => p.brand);
    const sortedBrands = [...brands].sort();
    expect(brands).toEqual(sortedBrands);
  });

  test('should get product by ID', async ({ request }) => {
    // Get first product
    const listResponse = await request.get('/api/products');
    const products = await listResponse.json();
    const productId = products[0].id;

    // Get product detail
    const response = await request.get(`/api/products/${productId}`);
    expect(response.ok()).toBeTruthy();

    const product = await response.json();
    expect(product.id).toBe(productId);
  });

  test('should return 404 for non-existent product', async ({ request }) => {
    const response = await request.get('/api/products/non-existent-id');
    expect(response.status()).toBe(404);
  });
});

test.describe('Cart Operations', () => {
  let sessionId: string;
  let productId: string;

  test.beforeAll(async ({ request }) => {
    // Get a product ID for testing
    const response = await request.get('/api/products');
    const products = await response.json();
    productId = products[0].id;
  });

  test.beforeEach(() => {
    sessionId = `test-${Date.now()}-${Math.random()}`;
  });

  test('should get empty cart', async ({ request }) => {
    const response = await request.get(`/api/cart/${sessionId}`);
    expect(response.ok()).toBeTruthy();

    const cart = await response.json();
    expect(Array.isArray(cart)).toBeTruthy();
    expect(cart.length).toBe(0);
  });

  test('should add item to cart', async ({ request }) => {
    const response = await request.post('/api/cart/items', {
      data: {
        sessionId,
        productId,
        quantity: 2
      }
    });

    expect(response.status()).toBe(201);
    const cartItem = await response.json();

    expect(cartItem).toHaveProperty('id');
    expect(cartItem.productId).toBe(productId);
    expect(cartItem.quantity).toBe(2);
    expect(cartItem.sessionId).toBe(sessionId);
  });

  test('should get cart with items', async ({ request }) => {
    // Add item
    await request.post('/api/cart/items', {
      data: { sessionId, productId, quantity: 2 }
    });

    // Get cart
    const response = await request.get(`/api/cart/${sessionId}`);
    const cart = await response.json();

    expect(cart.length).toBeGreaterThan(0);
    expect(cart[0].productId).toBe(productId);
  });

  test('should update cart item quantity', async ({ request }) => {
    // Add item
    const addResponse = await request.post('/api/cart/items', {
      data: { sessionId, productId, quantity: 2 }
    });
    const cartItem = await addResponse.json();

    // Update quantity
    const response = await request.put(`/api/cart/items/${cartItem.id}`, {
      data: { quantity: 5 }
    });

    expect(response.ok()).toBeTruthy();
    const updated = await response.json();
    expect(updated.quantity).toBe(5);
  });

  test('should reject invalid quantity (0)', async ({ request }) => {
    // Add item
    const addResponse = await request.post('/api/cart/items', {
      data: { sessionId, productId, quantity: 2 }
    });
    const cartItem = await addResponse.json();

    // Try to update with invalid quantity
    const response = await request.put(`/api/cart/items/${cartItem.id}`, {
      data: { quantity: 0 }
    });

    expect(response.status()).toBe(400);
  });

  test('should reject negative quantity', async ({ request }) => {
    // Add item
    const addResponse = await request.post('/api/cart/items', {
      data: { sessionId, productId, quantity: 2 }
    });
    const cartItem = await addResponse.json();

    // Try to update with negative quantity
    const response = await request.put(`/api/cart/items/${cartItem.id}`, {
      data: { quantity: -1 }
    });

    expect(response.status()).toBe(400);
  });

  test('should delete cart item', async ({ request }) => {
    // Add item
    const addResponse = await request.post('/api/cart/items', {
      data: { sessionId, productId, quantity: 2 }
    });
    const cartItem = await addResponse.json();

    // Delete item
    const response = await request.delete(`/api/cart/items/${cartItem.id}`);
    expect(response.status()).toBe(204);

    // Verify cart is empty
    const cartResponse = await request.get(`/api/cart/${sessionId}`);
    const cart = await cartResponse.json();
    expect(cart.length).toBe(0);
  });

  test('should return 404 for non-existent cart item', async ({ request }) => {
    const response = await request.delete('/api/cart/items/non-existent-id');
    expect(response.status()).toBe(404);
  });
});

test.describe('Order Processing', () => {
  let sessionId: string;
  let productId: string;

  test.beforeAll(async ({ request }) => {
    // Get a product ID for testing
    const response = await request.get('/api/products');
    const products = await response.json();
    productId = products[0].id;
  });

  test.beforeEach(() => {
    sessionId = `order-test-${Date.now()}-${Math.random()}`;
  });

  test('should create order from cart', async ({ request }) => {
    // Add item to cart
    await request.post('/api/cart/items', {
      data: { sessionId, productId, quantity: 2 }
    });

    // Create order
    const response = await request.post('/api/orders', {
      data: { sessionId }
    });

    expect(response.status()).toBe(201);
    const order = await response.json();

    expect(order).toHaveProperty('id');
    expect(order).toHaveProperty('sessionId');
    expect(order).toHaveProperty('totalAmount');
    expect(order).toHaveProperty('items');
    expect(order).toHaveProperty('status');
  });

  test('should clear cart after order creation', async ({ request }) => {
    // Add item to cart
    await request.post('/api/cart/items', {
      data: { sessionId, productId, quantity: 2 }
    });

    // Create order
    await request.post('/api/orders', {
      data: { sessionId }
    });

    // Verify cart is empty
    const cartResponse = await request.get(`/api/cart/${sessionId}`);
    const cart = await cartResponse.json();
    expect(cart.length).toBe(0);
  });

  test('should reject order with empty cart', async ({ request }) => {
    const response = await request.post('/api/orders', {
      data: { sessionId }
    });

    expect(response.status()).toBe(400);
  });

  test('should reject order without sessionId', async ({ request }) => {
    const response = await request.post('/api/orders', {
      data: {}
    });

    expect(response.status()).toBe(400);
  });
});

test.describe('Session Isolation', () => {
  let productId: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.get('/api/products');
    const products = await response.json();
    productId = products[0].id;
  });

  test('should keep sessions isolated', async ({ request }) => {
    const sessionA = `session-a-${Date.now()}`;
    const sessionB = `session-b-${Date.now()}`;

    // Add different quantities to different sessions
    await request.post('/api/cart/items', {
      data: { sessionId: sessionA, productId, quantity: 5 }
    });

    await request.post('/api/cart/items', {
      data: { sessionId: sessionB, productId, quantity: 10 }
    });

    // Verify session A has correct quantity
    const cartA = await (await request.get(`/api/cart/${sessionA}`)).json();
    expect(cartA[0].quantity).toBe(5);

    // Verify session B has correct quantity
    const cartB = await (await request.get(`/api/cart/${sessionB}`)).json();
    expect(cartB[0].quantity).toBe(10);
  });
});

test.describe('API Response Headers', () => {
  test('should have CORS headers', async ({ request }) => {
    const response = await request.fetch('/api/products', {
      method: 'OPTIONS'
    });

    const headers = response.headers();
    expect(headers['access-control-allow-origin']).toBeDefined();
  });

  test('should return JSON content-type for API endpoints', async ({ request }) => {
    const response = await request.get('/api/products');
    expect(response.headers()['content-type']).toContain('application/json');
  });
});

test.describe('Performance', () => {
  test('should handle rapid sequential requests', async ({ request }) => {
    const promises = Array.from({ length: 5 }, () =>
      request.get('/health')
    );

    const responses = await Promise.all(promises);
    responses.forEach(response => {
      expect(response.ok()).toBeTruthy();
    });
  });

  test('should respond within reasonable time', async ({ request }) => {
    const start = Date.now();
    await request.get('/api/products');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000); // Less than 1 second
  });
});
