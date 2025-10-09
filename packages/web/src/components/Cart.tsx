import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.tsx';
import CartItem from './CartItem.tsx';

const Cart: React.FC = () => {
  const { cart, loading } = useCart();

  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  if (loading && cart.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg">Loading cart...</p>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg mb-4">Your cart is empty</p>
        <Link
          to="/"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {cart.map((item) => (
          <CartItem key={item.id} item={item} />
        ))}
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xl font-semibold">Total:</span>
          <span className="text-2xl font-bold text-blue-600">
            ${total.toFixed(2)}
          </span>
        </div>
        <Link
          to="/checkout"
          className="block w-full bg-green-600 text-white text-center py-3 rounded-md hover:bg-green-700 font-semibold"
        >
          Proceed to Checkout
        </Link>
      </div>
    </div>
  );
};

export default Cart;
