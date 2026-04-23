import { OrderStatus, OrderType, PaymentStatus } from './enums';
import { Table } from './table.model';

export interface OrderItem {
  id: number;
  menuItemId: number;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string;
}

export interface Order {
  id: number;
  uniqueIdentifier: string;
  orderNumber: string;
  userId: number | null;
  customerFirstName: string;
  customerLastName: string;
  createdAt: string;
  status: OrderStatus;
  notes: string;
  totalPrice: number;
  orderType: OrderType;
  paymentStatus: PaymentStatus;
  items: OrderItem[];
  tables: Table[];
}

export interface CreateOrderItemInput {
  menuItemId: number;
  quantity: number;
  notes?: string;
}

export interface CreateOrderInput {
  userId?: number | null;
  customerFirstName: string;
  customerLastName: string;
  notes: string;
  orderType: OrderType;
  tableIds: number[];
  items: CreateOrderItemInput[];
}
