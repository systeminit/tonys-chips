import apiClient from '../config/api.ts';
import type { CartItem, AddToCartRequest, UpdateCartItemRequest } from '../types/index.ts';

export const getCart = async (sessionId: string): Promise<CartItem[]> => {
  const response = await apiClient.get<CartItem[]>(`/api/cart/${sessionId}`);
  return response.data;
};

export const addToCart = async (data: AddToCartRequest): Promise<CartItem> => {
  const response = await apiClient.post<CartItem>('/api/cart/items', data);
  return response.data;
};

export const updateCartItem = async (
  id: string,
  data: UpdateCartItemRequest
): Promise<CartItem> => {
  const response = await apiClient.put<CartItem>(`/api/cart/items/${id}`, data);
  return response.data;
};

export const removeFromCart = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/cart/items/${id}`);
};
