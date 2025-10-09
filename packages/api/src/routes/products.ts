import { Router, Request, Response } from 'express';
import prisma from '../config/database';

const router = Router();

// GET /api/products - List all products
router.get('/', async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: {
        brand: 'asc',
      },
    });
    res.json(products);
  } catch (error) {
    res.status(500);
    throw error;
  }
});

// GET /api/products/:id - Get single product
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json(product);
  } catch (error) {
    res.status(500);
    throw error;
  }
});

export default router;
