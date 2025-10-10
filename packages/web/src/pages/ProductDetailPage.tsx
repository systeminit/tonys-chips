import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Product } from '../types/index.ts';
import { getProduct } from '../services/productService.ts';
import { useCart } from '../hooks/useCart';

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await getProduct(id);
        setProduct(data);
      } catch (err) {
        setError('Failed to load product');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleAddToCart = async () => {
    if (!product) return;
    try {
      setAdding(true);
      await addToCart(product.id, quantity);
      navigate('/cart');
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg">Loading product...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 text-lg">{error || 'Product not found'}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="text-xs text-gray-600 mb-4">
        <button onClick={() => navigate('/')} className="hover:text-[#c7511f] hover:underline">
          Home
        </button>
        <span className="mx-2">›</span>
        <button onClick={() => navigate('/')} className="hover:text-[#c7511f] hover:underline">
          All Chips
        </button>
        <span className="mx-2">›</span>
        <span>{product.brand}</span>
        <span className="mx-2">›</span>
        <span>{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Product Image */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-gray-200 rounded p-6">
            <div className="aspect-square flex items-center justify-center">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </div>
        </div>

        {/* Product Info */}
        <div className="lg:col-span-4">
          <div className="bg-white">
            <h1 className="text-2xl font-normal text-gray-900 mb-2">
              {product.name}
            </h1>
            <p className="text-sm text-[#007185] hover:text-[#c7511f] mb-3 cursor-pointer">
              Visit the {product.brand} Store
            </p>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200">
              <div className="flex text-[#ffa41c] text-sm">
                {'★★★★★'.split('').map((star, i) => (
                  <span key={i}>{star}</span>
                ))}
              </div>
              <span className="text-sm text-[#007185]">{product.stockQuantity} ratings</span>
            </div>

            {/* Price */}
            <div className="mb-4">
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-sm text-gray-700">Price:</span>
                <span className="text-xs align-top text-gray-900">$</span>
                <span className="text-3xl font-normal text-gray-900">{Math.floor(product.price)}</span>
                <span className="text-sm align-top text-gray-900">{(product.price % 1).toFixed(2).substring(1)}</span>
              </div>
            </div>

            {/* Description */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h2 className="text-base font-bold mb-2">About this item</h2>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                <li>{product.description}</li>
                <li>Brand: {product.brand}</li>
                <li>Premium quality chips</li>
                <li>Perfect for snacking</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Buy Box */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-gray-200 rounded p-4 sticky top-4">
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-xs align-top">$</span>
              <span className="text-3xl font-normal">{Math.floor(product.price)}</span>
              <span className="text-sm align-top">{(product.price % 1).toFixed(2).substring(1)}</span>
            </div>

            <p className="text-xs text-gray-600 mb-3">FREE Returns</p>
            <p className="text-xs text-gray-600 mb-4">FREE delivery <b>Tomorrow</b></p>

            {product.stockQuantity > 0 ? (
              <p className="text-lg text-green-700 font-semibold mb-4">In Stock</p>
            ) : (
              <p className="text-lg text-red-600 font-semibold mb-4">Out of Stock</p>
            )}

            <div className="mb-4">
              <label className="text-xs font-bold block mb-1">Quantity:</label>
              <select
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value))}
                disabled={product.stockQuantity === 0}
                className="bg-[#f0f2f2] border border-gray-300 rounded shadow-sm text-sm px-3 py-2 w-full hover:bg-gray-100"
              >
                {[...Array(Math.min(10, product.stockQuantity))].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={product.stockQuantity === 0 || adding}
              className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-sm py-2 px-4 rounded-full border border-[#fcd200] shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed mb-2"
            >
              {adding ? 'Adding to Cart...' : 'Add to Cart'}
            </button>

            <button className="w-full bg-[#ffa41c] hover:bg-[#fa8900] text-sm py-2 px-4 rounded-full border border-[#ff8f00] shadow-sm">
              Buy Now
            </button>

            <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600 space-y-1">
              <p>Ships from Tony's Chips</p>
              <p>Sold by Tony's Chips</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
