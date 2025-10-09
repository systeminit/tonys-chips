import React, { useEffect, useState } from 'react';
import type { Product } from '../types/index.ts';
import { getProducts } from '../services/productService.ts';
import ProductGrid from '../components/ProductGrid.tsx';

const HomePage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const data = await getProducts();
        setProducts(data);
      } catch (err) {
        setError('Failed to load products');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg">Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 text-lg">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Amazon-style breadcrumb */}
      <div className="text-sm text-gray-700 mb-4">
        <span className="hover:text-[#c7511f] hover:underline cursor-pointer font-medium">Home</span>
        <span className="mx-2">›</span>
        <span className="font-medium">All Chips</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Premium Potato Chips & Snacks
      </h1>

      <ProductGrid products={products} />
    </div>
  );
};

export default HomePage;
