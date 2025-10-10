import { Router } from 'express';
import apiClient from '../services/apiClient';

const router = Router();

// View cart
router.get('/', async (req, res, next) => {
  try {
    const sessionId = req.session.cartSessionId!;
    const response = await apiClient.get(`/api/cart/${sessionId}`);
    const cartItems = response.data;

    // Calculate total
    const total = cartItems.reduce((sum: number, item: { product: { price: number }; quantity: number }) =>
      sum + (item.product.price * item.quantity), 0
    );

    res.render('cart', { cartItems, total });
  } catch (error) {
    next(error);
  }
});

// Add to cart
router.post('/add', async (req, res, next) => {
  try {
    const sessionId = req.session.cartSessionId!;
    const { productId, quantity } = req.body;

    await apiClient.post('/api/cart/items', {
      productId,
      quantity: parseInt(quantity),
      sessionId,
    });

    res.redirect('/cart');
  } catch (error) {
    next(error);
  }
});

// Update cart item
router.post('/update/:itemId', async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    await apiClient.put(`/api/cart/items/${itemId}`, {
      quantity: parseInt(quantity),
    });

    res.redirect('/cart');
  } catch (error) {
    next(error);
  }
});

// Remove from cart
router.post('/remove/:itemId', async (req, res, next) => {
  try {
    const { itemId } = req.params;
    await apiClient.delete(`/api/cart/items/${itemId}`);
    res.redirect('/cart');
  } catch (error) {
    next(error);
  }
});

export default router;
