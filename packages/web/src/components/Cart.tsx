import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import CartItem from './CartItem.tsx';

const Cart: React.FC = () => {
  const { cart, loading } = useCart();

  const total = cart.reduce(
    (sum: number, item) => sum + item.product.price * item.quantity,
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
      <div className="bg-white border border-gray-200 rounded p-8 text-center">
        <p className="text-2xl mb-4">Your Tony's Chips Cart is empty</p>
        <Link
          to="/"
          className="inline-block bg-[#ffd814] hover:bg-[#f7ca00] px-6 py-2 rounded-full border border-[#fcd200] shadow-sm"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  const itemCount = cart.reduce((sum: number, item) => sum + item.quantity, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Cart items */}
      <div className="lg:col-span-9">
        <div className="bg-white border border-gray-200 rounded">
          <div className="p-4 border-b border-gray-200">
            <p className="text-sm">
              <b>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'}):</b>{' '}
              <span className="text-lg font-bold">${total.toFixed(2)}</span>
            </p>
          </div>
          <div className="divide-y divide-gray-200">
            {cart.map((item: typeof cart[0]) => (
              <CartItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* Checkout sidebar */}
      <div className="lg:col-span-3">
        <div className="bg-white border border-gray-200 rounded p-4 sticky top-4">
          <div className="mb-4">
            <p className="text-sm mb-2">
              <b>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'}):</b>
            </p>
            <p className="text-lg font-bold">${total.toFixed(2)}</p>
          </div>
          <Link
            to="/checkout"
            className="block w-full bg-[#ffd814] hover:bg-[#f7ca00] text-sm py-2 px-4 rounded-full border border-[#fcd200] shadow-sm text-center"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Cart;
