import apiClient from '../config/api.ts';
import type { Order, CreateOrderRequest } from '../types/index.ts';

export const createOrder = async (data: CreateOrderRequest): Promise<Order> => {
  const response = await apiClient.post<Order>('/api/orders', data);
  return response.data;
};
