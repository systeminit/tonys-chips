import { createContext } from 'react';
import type { CartItem } from '../types/index.ts';

export interface CartContextType {
  cart: CartItem[];
  sessionId: string;
  loading: boolean;
  error: string | null;
  fetchCart: () => Promise<void>;
  addToCart: (productId: string, quantity: number) => Promise<void>;
  updateCartItem: (id: string, quantity: number) => Promise<void>;
  removeFromCart: (id: string) => Promise<void>;
  checkout: () => Promise<void>;
  clearError: () => void;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);
