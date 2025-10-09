import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useCart } from '../context/CartContext.tsx';

const Layout: React.FC = () => {
  const { cart } = useCart();
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-600 text-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link to="/" className="text-2xl font-bold hover:text-blue-100">
              Tony's World of Chips
            </Link>
            <nav className="flex gap-6 items-center">
              <Link to="/" className="hover:text-blue-100">
                Home
              </Link>
              <Link to="/cart" className="hover:text-blue-100 relative">
                Cart
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="bg-gray-800 text-white py-4">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2025 Tony's World of Chips. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
