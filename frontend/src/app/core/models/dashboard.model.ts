import { PaymentMethod } from './enums';

export interface TopDish {
  menuItemId: number;
  name: string;
  quantity: number;
  revenue: number;
}

export interface PaymentBreakdown {
  method: PaymentMethod;
  amount: number;
  count: number;
}

export interface DashboardSummary {
  totalRevenueToday: number;
  totalRevenueThisMonth: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  unpaidOrders: number;
  reservationsToday: number;
  pendingReservations: number;
  occupiedTables: number;
  availableTables: number;
  topDishes: TopDish[];
  paymentBreakdown: PaymentBreakdown[];
}
