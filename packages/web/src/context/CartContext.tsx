import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { CartItem } from '../types/index.ts';
import * as cartService from '../services/cartService.ts';
import * as orderService from '../services/orderService.ts';

interface CartContextType {
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

const CartContext = createContext<CartContextType | undefined>(undefined);

const generateSessionId = (): string => {
  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sessionId] = useState<string>(generateSessionId());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCart = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await cartService.getCart(sessionId);
      setCart(data);
    } catch (err) {
      setError('Failed to fetch cart');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (productId: string, quantity: number) => {
    try {
      setLoading(true);
      setError(null);
      await cartService.addToCart({ productId, quantity, sessionId });
      await fetchCart();
    } catch (err) {
      setError('Failed to add item to cart');
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateCartItem = async (id: string, quantity: number) => {
    try {
      setLoading(true);
      setError(null);
      await cartService.updateCartItem(id, { quantity });
      await fetchCart();
    } catch (err) {
      setError('Failed to update cart item');
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeFromCart = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      await cartService.removeFromCart(id);
      await fetchCart();
    } catch (err) {
      setError('Failed to remove item from cart');
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const checkout = async () => {
    try {
      setLoading(true);
      setError(null);
      await orderService.createOrder({ sessionId });
      setCart([]);
    } catch (err) {
      setError('Failed to complete checkout');
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  useEffect(() => {
    fetchCart();
  }, [sessionId]);

  return (
    <CartContext.Provider
      value={{
        cart,
        sessionId,
        loading,
        error,
        fetchCart,
        addToCart,
        updateCartItem,
        removeFromCart,
        checkout,
        clearError,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
