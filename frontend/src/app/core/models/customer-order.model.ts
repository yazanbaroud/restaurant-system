import { OrderType } from './enums';

export interface CustomerOrderItemInput {
  menuItemId: number;
  quantity: number;
  notes?: string;
}

export interface CreateCustomerOrderInput {
  orderType: OrderType;
  tableId?: number | null;
  notes?: string;
  items: CustomerOrderItemInput[];
}

export interface UpdateCustomerOrderInput {
  orderType: OrderType;
  tableId?: number | null;
  notes?: string;
}

export interface UpdateCustomerOrderItemInput {
  quantity: number;
  notes?: string;
}

export interface CustomerTableOption {
  id: number;
  name: string;
  capacity: number;
}
