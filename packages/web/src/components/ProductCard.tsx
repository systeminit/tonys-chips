import React from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../types/index.ts';
import { useCart } from '../hooks/useCart';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart } = useCart();
  const [adding, setAdding] = React.useState(false);

  const handleAddToCart = async () => {
    try {
      setAdding(true);
      await addToCart(product.id, 1);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 hover:shadow-xl transition-shadow">
      <Link to={`/products/${product.id}`} className="block">
        <div className="aspect-square mb-3 flex items-center justify-center bg-white">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      </Link>
      <div>
        <Link to={`/products/${product.id}`}>
          <h3 className="text-base font-medium text-gray-900 hover:text-[#c7511f] line-clamp-2 mb-2 min-h-[48px]">
            {product.name}
          </h3>
        </Link>
        <p className="text-sm text-gray-700 mb-2 font-medium">{product.brand}</p>

        {/* Amazon-style rating (placeholder) */}
        <div className="flex items-center gap-1 mb-3">
          <div className="flex text-[#ffa41c]">
            {'★★★★★'.split('').map((star, i) => (
              <span key={i} className="text-base">{star}</span>
            ))}
          </div>
          <span className="text-sm text-[#007185] font-medium">({product.stockQuantity})</span>
        </div>

        {/* Price */}
        <div className="mb-4">
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-sm align-top font-bold text-gray-900">$</span>
            <span className="text-3xl font-bold text-gray-900">{Math.floor(product.price)}</span>
            <span className="text-sm align-top font-bold text-gray-900">{(product.price % 1).toFixed(2).substring(1)}</span>
          </div>
          {product.stockQuantity > 0 ? (
            <p className="text-sm text-green-700 font-bold">In Stock</p>
          ) : (
            <p className="text-sm text-red-600 font-bold">Out of Stock</p>
          )}
        </div>

        <button
          onClick={handleAddToCart}
          disabled={product.stockQuantity === 0 || adding}
          className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-sm font-bold py-2.5 px-4 rounded-lg border border-[#fcd200] shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {adding ? 'Adding...' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
