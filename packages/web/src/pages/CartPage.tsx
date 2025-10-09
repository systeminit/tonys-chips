import React from 'react';
import Cart from '../components/Cart.tsx';

const CartPage: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-normal text-gray-900 mb-6">Shopping Cart</h1>
      <Cart />
    </div>
  );
};

export default CartPage;
