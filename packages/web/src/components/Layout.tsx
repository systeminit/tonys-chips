import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useCart } from '../hooks/useCart';

const Layout: React.FC = () => {
  const { cart } = useCart();
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-[#131921] text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-3 gap-6">
            {/* Logo */}
            <Link to="/" className="flex items-center hover:border hover:border-white px-3 py-2 transition-all text-white no-underline">
              <span className="text-2xl font-bold">Tony's</span>
              <span className="text-base ml-2 font-medium">Chips</span>
            </Link>

            {/* Cart */}
            <Link to="/cart" className="hover:border hover:border-white px-3 py-2 transition-all relative flex items-center text-white no-underline">
              <div className="relative">
                <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 left-5 bg-[#f08804] text-white text-sm font-bold rounded-full h-6 w-6 flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </div>
              <span className="ml-2 text-base font-bold">Cart</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Simplified footer */}
      <footer className="bg-[#232f3e] text-white mt-auto">
        <div className="bg-[#131921] py-8">
          <div className="max-w-7xl mx-auto px-4 text-center text-base text-gray-300">
            <p>&copy; 2025 Tony's World of Chips. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
