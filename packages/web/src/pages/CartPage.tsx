import React from 'react';
import Cart from '../components/Cart.tsx';

const CartPage: React.FC = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Shopping Cart</h1>
      <Cart />
    </div>
  );
};

export default CartPage;
