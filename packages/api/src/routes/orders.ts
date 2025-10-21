import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../config/database';

const router = Router();

// POST /api/orders - Create order (checkout stub)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    // Get cart items for this session
    const prisma = await getPrismaClient();
    const cartItems = await prisma.cartItem.findMany({
      where: { sessionId },
      include: { product: true },
    });

    if (cartItems.length === 0) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }

    // Calculate total amount
    const totalAmount = cartItems.reduce((total: number, item: typeof cartItems[0]) => {
      return total + (item.product.price * item.quantity);
    }, 0);

    // Prepare order items as JSON
    const orderItems = cartItems.map((item: typeof cartItems[0]) => ({
      productId: item.productId,
      productName: item.product.name,
      brand: item.product.brand,
      price: item.product.price,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity,
    }));

    // Create order
    const order = await prisma.order.create({
      data: {
        sessionId,
        items: JSON.stringify(orderItems),
        totalAmount,
        status: 'completed', // Stub checkout - no payment, so mark as completed
      },
    });

    // Clear cart items for this session
    await prisma.cartItem.deleteMany({
      where: { sessionId },
    });

    // Return order with parsed items
    res.status(201).json({
      ...order,
      items: orderItems,
    });
  } catch (error) {
    res.status(500);
    throw error;
  }
});

export default router;
