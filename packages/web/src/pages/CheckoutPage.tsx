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
      <div className="bg-white border border-gray-200 rounded p-8 text-center">
        <p className="text-xl mb-4">Your cart is empty</p>
        <button
          onClick={() => navigate('/')}
          className="bg-[#ffd814] hover:bg-[#f7ca00] px-6 py-2 rounded-full border border-[#fcd200] shadow-sm"
        >
          Continue Shopping
        </button>
      </div>
    );
  }

  if (orderComplete) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white border border-gray-200 rounded p-8 text-center">
          <div className="text-6xl mb-4 text-green-600">✓</div>
          <h1 className="text-2xl font-normal text-gray-900 mb-4">
            Order Confirmed!
          </h1>
          <p className="text-base text-gray-700 mb-4">
            Thank you for your order. Your chips are on their way!
          </p>
          <p className="text-sm text-gray-600 mb-6">
            This is a demo checkout - no payment was processed.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-[#ffd814] hover:bg-[#f7ca00] px-6 py-2 rounded-full border border-[#fcd200] shadow-sm"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-normal text-gray-900 mb-6">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Shipping Address */}
          <div className="bg-white border border-gray-200 rounded">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold">1. Shipping Address</h2>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-700">Demo User</p>
              <p className="text-sm text-gray-600">123 Chip Street</p>
              <p className="text-sm text-gray-600">Snack City, SC 12345</p>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white border border-gray-200 rounded">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold">2. Payment Method</h2>
            </div>
            <div className="p-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                <p className="text-sm text-gray-700">
                  <strong>Note:</strong> This is a demo checkout. No payment information is required or processed.
                </p>
              </div>
            </div>
          </div>

          {/* Review Items */}
          <div className="bg-white border border-gray-200 rounded">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold">3. Review Items</h2>
            </div>
            <div className="p-4 space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="w-20 h-20 flex-shrink-0">
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-normal text-gray-900">{item.product.name}</p>
                    <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    <p className="text-sm font-bold text-gray-900">${(item.product.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded p-4 sticky top-4">
            <button
              onClick={handleCheckout}
              disabled={processing}
              className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-sm py-2 px-4 rounded-full border border-[#fcd200] shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed mb-4"
            >
              {processing ? 'Processing...' : 'Place your order'}
            </button>

            <div className="text-xs text-gray-600 mb-4">
              By placing your order, you agree to Tony's Chips <span className="text-[#007185]">privacy notice</span> and{' '}
              <span className="text-[#007185]">conditions of use</span>.
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-lg font-bold mb-3">Order Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Items ({itemCount}):</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping & handling:</span>
                  <span>$0.00</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-[#b12704]">
                  <span>Order total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
