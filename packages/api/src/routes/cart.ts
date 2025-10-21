import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../config/database';

const router = Router();

// POST /api/cart/items - Add item to cart
router.post('/items', async (req: Request, res: Response) => {
  try {
    const { productId, quantity, sessionId } = req.body;

    if (!productId || quantity === undefined || quantity === null || !sessionId) {
      res.status(400).json({ error: 'productId, quantity, and sessionId are required' });
      return;
    }

    if (quantity < 1) {
      res.status(400).json({ error: 'quantity must be at least 1' });
      return;
    }

    // Check if product exists
    const prisma = await getPrismaClient();
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Check if item already in cart for this session
    const existingCartItem = await prisma.cartItem.findFirst({
      where: {
        productId,
        sessionId,
      },
    });

    let cartItem;
    if (existingCartItem) {
      // Update existing cart item
      cartItem = await prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: { quantity: existingCartItem.quantity + quantity },
        include: { product: true },
      });
    } else {
      // Create new cart item
      cartItem = await prisma.cartItem.create({
        data: {
          productId,
          quantity,
          sessionId,
        },
        include: { product: true },
      });
    }

    res.status(201).json(cartItem);
  } catch (error) {
    res.status(500);
    throw error;
  }
});

// GET /api/cart/:sessionId - Get cart by session
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const prisma = await getPrismaClient();
    const cartItems = await prisma.cartItem.findMany({
      where: { sessionId },
      include: { product: true },
      orderBy: { createdAt: 'asc' },
    });

    res.json(cartItems);
  } catch (error) {
    res.status(500);
    throw error;
  }
});

// PUT /api/cart/items/:id - Update cart item quantity
router.put('/items/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || quantity === null) {
      res.status(400).json({ error: 'quantity is required' });
      return;
    }

    if (quantity < 1) {
      res.status(400).json({ error: 'quantity must be at least 1' });
      return;
    }

    const prisma = await getPrismaClient();
    const cartItem = await prisma.cartItem.findUnique({
      where: { id },
    });

    if (!cartItem) {
      res.status(404).json({ error: 'Cart item not found' });
      return;
    }

    const updatedCartItem = await prisma.cartItem.update({
      where: { id },
      data: { quantity },
      include: { product: true },
    });

    res.json(updatedCartItem);
  } catch (error) {
    res.status(500);
    throw error;
  }
});

// DELETE /api/cart/items/:id - Remove cart item
router.delete('/items/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const prisma = await getPrismaClient();
    const cartItem = await prisma.cartItem.findUnique({
      where: { id },
    });

    if (!cartItem) {
      res.status(404).json({ error: 'Cart item not found' });
      return;
    }

    await prisma.cartItem.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    res.status(500);
    throw error;
  }
});

export default router;
