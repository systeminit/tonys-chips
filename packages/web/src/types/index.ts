export interface Product {
  id: string;
  name: string;
  brand: string;
  description: string;
  price: number;
  imageUrl: string;
  stockQuantity: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  sessionId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Order {
  id: string;
  sessionId: string;
  items: string;
  totalAmount: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AddToCartRequest {
  productId: string;
  quantity: number;
  sessionId: string;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface CreateOrderRequest {
  sessionId: string;
}
