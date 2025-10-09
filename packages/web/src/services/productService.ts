import apiClient from '../config/api.ts';
import type { Product } from '../types/index.ts';

export const getProducts = async (): Promise<Product[]> => {
  const response = await apiClient.get<Product[]>('/api/products');
  return response.data;
};

export const getProduct = async (id: string): Promise<Product> => {
  const response = await apiClient.get<Product>(`/api/products/${id}`);
  return response.data;
};
