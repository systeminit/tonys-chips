import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.tsx';

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { cart, checkout } = useCart();
  const [processing, setProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);

  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const handleCheckout = async () => {
    try {
      setProcessing(true);
      await checkout();
      setOrderComplete(true);
    } catch (error) {
      console.error('Checkout failed:', error);
    } finally {
      setProcessing(false);
    }
  };

  if (cart.length === 0 && !orderComplete) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg mb-4">Your cart is empty</p>
        <button
          onClick={() => navigate('/')}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          Continue Shopping
        </button>
      </div>
    );
  }

  if (orderComplete) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">✓</div>
          <h1 className="text-3xl font-bold text-green-800 mb-4">
            Order Confirmed!
          </h1>
          <p className="text-gray-700 mb-6">
            Thank you for your order. Your chips are on their way!
          </p>
          <p className="text-gray-600 mb-8">
            This is a demo checkout - no payment was processed.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-semibold"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Checkout</h1>
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
        <div className="space-y-3">
          {cart.map((item) => (
            <div key={item.id} className="flex justify-between text-gray-700">
              <span>
                {item.product.name} x {item.quantity}
              </span>
              <span>${(item.product.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="border-t mt-4 pt-4 flex justify-between items-center">
          <span className="text-xl font-semibold">Total:</span>
          <span className="text-2xl font-bold text-blue-600">
            ${total.toFixed(2)}
          </span>
        </div>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <p className="text-gray-700">
          <strong>Note:</strong> This is a demo checkout. No payment information
          is required or processed.
        </p>
      </div>
      <button
        onClick={handleCheckout}
        disabled={processing}
        className="w-full bg-green-600 text-white py-3 rounded-md hover:bg-green-700 disabled:bg-gray-400 font-semibold text-lg"
      >
        {processing ? 'Processing...' : 'Complete Order'}
      </button>
    </div>
  );
};

export default CheckoutPage;
