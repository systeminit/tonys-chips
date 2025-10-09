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
    <div className="flex gap-4 p-4">
      <div className="w-32 h-32 flex-shrink-0">
        <img
          src={item.product.imageUrl}
          alt={item.product.name}
          className="w-full h-full object-contain"
        />
      </div>
      <div className="flex-1">
        <h3 className="text-base font-normal text-gray-900 mb-1">
          {item.product.name}
        </h3>
        <p className="text-sm text-green-700 font-semibold mb-2">In Stock</p>
        <p className="text-xs text-gray-600 mb-3">Brand: {item.product.brand}</p>

        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center border border-gray-300 rounded">
            <button
              onClick={handleDecrement}
              disabled={item.quantity === 1 || updating}
              className="px-3 py-1 hover:bg-gray-100 disabled:bg-gray-50 disabled:cursor-not-allowed border-r border-gray-300"
            >
              -
            </button>
            <span className="px-4 py-1 bg-[#f0f2f2] min-w-[50px] text-center">{item.quantity}</span>
            <button
              onClick={handleIncrement}
              disabled={updating}
              className="px-3 py-1 hover:bg-gray-100 disabled:bg-gray-50 disabled:cursor-not-allowed border-l border-gray-300"
            >
              +
            </button>
          </div>

          <button
            onClick={handleRemove}
            className="text-sm text-[#007185] hover:text-[#c7511f] hover:underline"
          >
            Delete
          </button>
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-gray-900">
          ${subtotal.toFixed(2)}
        </p>
      </div>
    </div>
  );
};

export default CartItem;
