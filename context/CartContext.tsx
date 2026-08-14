'use client';

import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { Product, ProductOption } from '@/data/products';
import { calculateDiscount } from '@/lib/commerce/pricing';

export interface CartItem {
  cartItemId: string; // unique ID including selected options
  product: Product;
  quantity: number;
  selectedOptions: ProductOption[];
  unitPrice: number;
  itemTotal: number;
  specialNote?: string;
}

export interface AppliedVoucher {
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number; // e.g. 10 (%) or 20000 (đ)
  descriptionVi: string;
  descriptionEn: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, selectedOptions?: ProductOption[], specialNote?: string) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  cartCount: number;
  subtotal: number;
  discountAmount: number;
  finalTotal: number;
  usePoints: boolean;
  setUsePoints: (enabled: boolean) => void;
  appliedVoucher: AppliedVoucher | null;
  applyVoucher: (code: string) => { success: boolean; message: string };
  applyVoucherDetails: (voucher: AppliedVoucher) => void;
  removeVoucher: () => void;
  syncCatalog: (products: Product[]) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const CART_STORAGE_VERSION = 2;

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedVoucher | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Load cart from localStorage
  /* eslint-disable react-hooks/set-state-in-effect -- Cart draft hydrates from browser storage after mount. */
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('beanbus_cart');
      if (savedCart) {
        const parsed = JSON.parse(savedCart) as CartItem[] | { version: number; items: CartItem[] };
        setCart(Array.isArray(parsed) ? parsed : parsed.version === CART_STORAGE_VERSION ? parsed.items : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setHasHydrated(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Save cart to localStorage
  useEffect(() => {
    if (!hasHydrated) return;
    try {
      localStorage.setItem('beanbus_cart', JSON.stringify({ version: CART_STORAGE_VERSION, items: cart }));
    } catch (e) {
      console.error(e);
    }
  }, [cart, hasHydrated]);

  const addToCart = (
    product: Product,
    quantity = 1,
    selectedOptions: ProductOption[] = [],
    specialNote = ''
  ) => {
    // Generate unique ID based on product & options
    const optionIds = selectedOptions.map((o) => o.id).sort().join('-');
    const cartItemId = `${product.id}-${optionIds}-${specialNote}`;

    const optionsExtra = selectedOptions.reduce((acc, opt) => acc + opt.extraPrice, 0);
    const unitPrice = product.price + optionsExtra;

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.cartItemId === cartItemId);
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantity;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          itemTotal: newQty * unitPrice,
        };
        return updated;
      }
      return [
        ...prev,
        {
          cartItemId,
          product,
          quantity,
          selectedOptions,
          unitPrice,
          itemTotal: quantity * unitPrice,
          specialNote,
        },
      ];
    });

    setIsCartOpen(true);
  };

  const syncCatalog = useCallback((products: Product[]) => {
    if (products.length === 0) return;
    setCart((current) => current.flatMap((item) => {
      const product = products.find((candidate) => candidate.id === item.product.id);
      if (!product) return [];
      const selectedOptions = product.options
        ? item.selectedOptions
          .map((option) => product.options?.find((candidate) => candidate.id === option.id))
          .filter((option): option is ProductOption => Boolean(option))
        : item.selectedOptions;
      const optionIds = selectedOptions.map((option) => option.id).sort().join('-');
      const cartItemId = `${product.id}-${optionIds}-${item.specialNote ?? ''}`;
      const unitPrice = product.price + selectedOptions.reduce((sum, option) => sum + option.extraPrice, 0);
      return [{ ...item, cartItemId, product, selectedOptions, unitPrice, itemTotal: item.quantity * unitPrice }];
    }));
  }, []);

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.cartItemId === cartItemId) {
          return {
            ...item,
            quantity,
            itemTotal: quantity * item.unitPrice,
          };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCart([]);
    setAppliedVoucher(null);
    setUsePoints(false);
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.itemTotal, 0);

  const discountAmount = calculateDiscount(
    subtotal,
    appliedVoucher
      ? { type: appliedVoucher.discountType, value: appliedVoucher.discountValue }
      : null
  );

  const finalTotal = subtotal - discountAmount;

  const applyVoucher = (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode === 'BEANBUS10') {
      const v: AppliedVoucher = {
        code: 'BEANBUS10',
        discountType: 'percent',
        discountValue: 10,
        descriptionVi: 'Giảm 10% tổng đơn hàng',
        descriptionEn: '10% off total order',
      };
      setAppliedVoucher(v);
      return { success: true, message: 'Đã áp dụng mã giảm giá 10%!' };
    }
    if (cleanCode === 'WELCOMEVIP') {
      const v: AppliedVoucher = {
        code: 'WELCOMEVIP',
        discountType: 'fixed',
        discountValue: 20000,
        descriptionVi: 'Giảm 20.000đ cho hội viên mới',
        descriptionEn: '20,000đ off for new members',
      };
      setAppliedVoucher(v);
      return { success: true, message: 'Đã áp dụng mã giảm giá 20.000đ!' };
    }
    return { success: false, message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' };
  };

  const applyVoucherDetails = (voucher: AppliedVoucher) => {
    setAppliedVoucher(voucher);
  };

  const removeVoucher = () => {
    setAppliedVoucher(null);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        cartCount,
        subtotal,
        discountAmount,
        finalTotal,
        usePoints,
        setUsePoints,
        appliedVoucher,
        applyVoucher,
        applyVoucherDetails,
        removeVoucher,
        syncCatalog,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};
