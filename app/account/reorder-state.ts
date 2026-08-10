import type { Product, ProductOption } from '@/data/products';

export type ReorderItem = {
  product: Product;
  quantity: number;
  selectedOptions: ProductOption[];
  specialNote?: string;
};

export type ReorderState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  orderId?: string;
  items: ReorderItem[];
  skipped: number;
};

export const initialReorderState: ReorderState = {
  status: 'idle',
  message: '',
  items: [],
  skipped: 0,
};
