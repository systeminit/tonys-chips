import { Router } from 'express';
import apiClient from '../services/apiClient';

const router = Router();

// Checkout - create order
router.post('/checkout', async (req, res, next) => {
  try {
    const sessionId = req.session.cartSessionId!;

    const response = await apiClient.post('/api/orders', {
      sessionId,
    });

    const order = response.data;
    res.render('checkout', { order });
  } catch (error) {
    next(error);
  }
});

export default router;
