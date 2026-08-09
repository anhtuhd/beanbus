'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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
  appliedVoucher: AppliedVoucher | null;
  applyVoucher: (code: string) => { success: boolean; message: string };
  removeVoucher: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedVoucher | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Load cart from localStorage
  /* eslint-disable react-hooks/set-state-in-effect -- Cart draft hydrates from browser storage after mount. */
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('beanbus_cart');
      if (savedCart) {
        setCart(JSON.parse(savedCart));
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
      localStorage.setItem('beanbus_cart', JSON.stringify(cart));
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
        appliedVoucher,
        applyVoucher,
        removeVoucher,
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
