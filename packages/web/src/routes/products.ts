import { Router } from 'express';
import axios from 'axios';
import apiClient from '../services/apiClient';

const router = Router();

// Home page - list all products
router.get('/', async (req, res, next) => {
  try {
    const response = await apiClient.get('/api/products');
    const products = response.data;
    res.render('home', { products });
  } catch (error) {
    next(error);
  }
});

// Product detail page
router.get('/products/:id', async (req, res, next) => {
  try {
    const response = await apiClient.get(`/api/products/${req.params.id}`);
    const product = response.data;
    res.render('product-detail', { product });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      res.status(404).render('error', { error: 'Product not found' });
    } else {
      next(error);
    }
  }
});

export default router;
