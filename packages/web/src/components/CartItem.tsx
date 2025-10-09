import React from 'react';
import type { CartItem as CartItemType } from '../types/index.ts';
import { useCart } from '../context/CartContext.tsx';

interface CartItemProps {
  item: CartItemType;
}

const CartItem: React.FC<CartItemProps> = ({ item }) => {
  const { updateCartItem, removeFromCart } = useCart();
  const [updating, setUpdating] = React.useState(false);

  const handleIncrement = async () => {
    try {
      setUpdating(true);
      await updateCartItem(item.id, item.quantity + 1);
    } catch (error) {
      console.error('Failed to update cart item:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleDecrement = async () => {
    if (item.quantity === 1) return;
    try {
      setUpdating(true);
      await updateCartItem(item.id, item.quantity - 1);
    } catch (error) {
      console.error('Failed to update cart item:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleRemove = async () => {
    try {
      await removeFromCart(item.id);
    } catch (error) {
      console.error('Failed to remove cart item:', error);
    }
  };

  const subtotal = item.product.price * item.quantity;

  return (
    <div className="flex gap-4 p-4 bg-white rounded-lg shadow-md">
      <img
        src={item.product.imageUrl}
        alt={item.product.name}
        className="w-24 h-24 object-cover rounded"
      />
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-gray-800">
          {item.product.name}
        </h3>
        <p className="text-sm text-gray-600">{item.product.brand}</p>
        <p className="text-blue-600 font-semibold mt-1">
          ${item.product.price.toFixed(2)}
        </p>
      </div>
      <div className="flex flex-col items-end justify-between">
        <button
          onClick={handleRemove}
          className="text-red-500 hover:text-red-700 text-sm"
        >
          Remove
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDecrement}
            disabled={item.quantity === 1 || updating}
            className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed px-3 py-1 rounded"
          >
            -
          </button>
          <span className="w-8 text-center font-semibold">{item.quantity}</span>
          <button
            onClick={handleIncrement}
            disabled={updating}
            className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed px-3 py-1 rounded"
          >
            +
          </button>
        </div>
        <p className="text-lg font-bold text-gray-800">
          ${subtotal.toFixed(2)}
        </p>
      </div>
    </div>
  );
};

export default CartItem;
