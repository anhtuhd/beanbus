'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem } from './CartContext';
import { createDemoOrderCode } from '@/lib/orders/demo-order-code';
import type { AppMode } from '@/lib/env';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PaymentMethod = 'sepay_qr' | 'cod';
export type PaymentStatus = 'pending' | 'paid';
export type OrderType = 'pickup' | 'delivery';

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  pickupTime?: string;
  deliveryAddress?: string;
  note?: string;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  finalTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  createdAt: string;
  sepayCode?: string;
}

export interface Booking {
  id: string;
  name: string;
  phone: string;
  email?: string;
  date: string;
  time: string;
  guestCount: number;
  seatingArea: 'indoor' | 'balcony' | 'roastery_bar';
  occasion?: string;
  note?: string;
  status: 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

interface OrderContextType {
  orders: Order[];
  bookings: Booking[];
  createOrder: (orderData: Omit<Order, 'id' | 'createdAt' | 'status' | 'paymentStatus' | 'sepayCode'>) => Order;
  updateOrderStatus: (orderId: string, status: OrderStatus, paymentStatus?: PaymentStatus) => void;
  createBooking: (bookingData: Omit<Booking, 'id' | 'createdAt' | 'status'>) => Booking;
  updateBookingStatus: (bookingId: string, status: Booking['status']) => void;
  cancelBooking: (bookingId: string) => void;
}

const INITIAL_ORDERS: Order[] = [
  {
    id: 'DH-260809A1B2C3',
    customerName: 'Nguyễn Văn Bean',
    customerPhone: '0987 654 321',
    orderType: 'pickup',
    pickupTime: '2026-08-09T11:30',
    items: [
      {
        cartItemId: 'cd-1-default',
        product: {
          id: 'cd-1',
          categoryId: 'colddrip',
          nameVi: 'Cold-drip Quế Hoa',
          nameEn: 'Osmanthus Cold-drip',
          descriptionVi: 'Cold-drip hoa quế',
          descriptionEn: 'Osmanthus cold drip',
          price: 35000,
          image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=800&auto=format&fit=crop',
          isAvailable: true,
        },
        quantity: 2,
        selectedOptions: [],
        unitPrice: 35000,
        itemTotal: 70000,
      },
      {
        cartItemId: 'pas-1-default',
        product: {
          id: 'pas-1',
          categoryId: 'pastry',
          nameVi: 'Croissant Bơ Pháp Tươi',
          nameEn: 'Fresh French Butter Croissant',
          descriptionVi: 'Bánh sừng bò ngàn lớp',
          descriptionEn: 'French croissant',
          price: 35000,
          image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=800&auto=format&fit=crop',
          isAvailable: true,
        },
        quantity: 1,
        selectedOptions: [],
        unitPrice: 35000,
        itemTotal: 35000,
      },
    ],
    subtotal: 105000,
    discountAmount: 10500,
    finalTotal: 94500,
    paymentMethod: 'sepay_qr',
    paymentStatus: 'paid',
    status: 'ready',
    createdAt: '2026-08-09T10:15:00Z',
    sepayCode: 'DH-260809A1B2C3',
  },
  {
    id: 'DH-260809D4E5F6',
    customerName: 'Trần Thị Mỹ Linh',
    customerPhone: '0912 345 678',
    orderType: 'delivery',
    deliveryAddress: 'Số 12 Trần Phú, Phường Máy Tơ, Hải Phòng',
    items: [
      {
        cartItemId: 'esp-1-default',
        product: {
          id: 'esp-1',
          categoryId: 'espresso',
          nameVi: 'Cà Phê Kem Béo (Creamy Foam)',
          nameEn: 'Creamy Foam Coffee',
          descriptionVi: 'Espresso với kem béo',
          descriptionEn: 'Creamy foam coffee',
          price: 40000,
          image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?q=80&w=800&auto=format&fit=crop',
          isAvailable: true,
        },
        quantity: 3,
        selectedOptions: [],
        unitPrice: 40000,
        itemTotal: 120000,
      },
    ],
    subtotal: 120000,
    discountAmount: 0,
    finalTotal: 120000,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    status: 'preparing',
    createdAt: '2026-08-09T09:45:00Z',
  },
];

const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 'BK-2026-104',
    name: 'Nguyễn Văn Bean',
    phone: '0987 654 321',
    email: 'khachhang@beanbus.vn',
    date: '2026-08-10',
    time: '14:30',
    guestCount: 4,
    seatingArea: 'balcony',
    occasion: 'Gặp gỡ bạn bè',
    note: 'Cho nhóm ngồi cạnh cửa sổ lớn',
    status: 'confirmed',
    createdAt: '2026-08-08T14:00:00Z',
  },
];

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const OrderProvider: React.FC<{ children: React.ReactNode; mode?: AppMode }> = ({ children, mode = 'demo' }) => {
  const isDemo = mode === 'demo';
  const [orders, setOrders] = useState<Order[]>(() => (isDemo ? INITIAL_ORDERS : []));
  const [bookings, setBookings] = useState<Booking[]>(() => (isDemo ? INITIAL_BOOKINGS : []));

  /* eslint-disable react-hooks/set-state-in-effect -- Prototype orders hydrate from browser storage until server persistence lands. */
  useEffect(() => {
    if (!isDemo) return;
    try {
      const savedOrders = localStorage.getItem('beanbus_orders');
      if (savedOrders) setOrders(JSON.parse(savedOrders));

      const savedBookings = localStorage.getItem('beanbus_bookings');
      if (savedBookings) setBookings(JSON.parse(savedBookings));
    } catch (e) {
      console.error(e);
    }
  }, [isDemo]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const saveOrders = (newOrders: Order[]) => {
    if (!isDemo) return;
    setOrders(newOrders);
    localStorage.setItem('beanbus_orders', JSON.stringify(newOrders));
  };

  const saveBookings = (newBookings: Booking[]) => {
    if (!isDemo) return;
    setBookings(newBookings);
    localStorage.setItem('beanbus_bookings', JSON.stringify(newBookings));
  };

  const createOrder = (
    orderData: Omit<Order, 'id' | 'createdAt' | 'status' | 'paymentStatus' | 'sepayCode'>
  ): Order => {
    const orderId = createDemoOrderCode();
    const sepayCode = orderId;

    const newOrder: Order = {
      ...orderData,
      id: orderId,
      status: 'pending',
      paymentStatus: orderData.paymentMethod === 'sepay_qr' ? 'pending' : 'pending',
      createdAt: new Date().toISOString(),
      sepayCode,
    };

    saveOrders([newOrder, ...orders]);
    return newOrder;
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus, paymentStatus?: PaymentStatus) => {
    const updated = orders.map((o) => {
      if (o.id === orderId) {
        return {
          ...o,
          status,
          paymentStatus: paymentStatus || o.paymentStatus,
        };
      }
      return o;
    });
    saveOrders(updated);
  };

  const createBooking = (bookingData: Omit<Booking, 'id' | 'createdAt' | 'status'>): Booking => {
    const bookingId = `BK-2026-${Math.floor(100 + Math.random() * 900)}`;
    const newBooking: Booking = {
      ...bookingData,
      id: bookingId,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };
    saveBookings([newBooking, ...bookings]);
    return newBooking;
  };

  const cancelBooking = (bookingId: string) => {
    const updated = bookings.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' as const } : b));
    saveBookings(updated);
  };

  const updateBookingStatus = (bookingId: string, status: Booking['status']) => {
    saveBookings(bookings.map((booking) => (
      booking.id === bookingId ? { ...booking, status } : booking
    )));
  };

  return (
    <OrderContext.Provider
      value={{
        orders,
        bookings,
        createOrder,
        updateOrderStatus,
        createBooking,
        updateBookingStatus,
        cancelBooking,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) throw new Error('useOrders must be used within OrderProvider');
  return context;
};
