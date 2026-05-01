import { PaymentMethod } from './enums';

export interface Payment {
  id: number;
  orderId: number;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  recordedByUserId?: number;
  note?: string;
}

export interface PaymentRefund {
  id: number;
  orderId: number;
  amount: number;
  method: PaymentMethod;
  reason: string;
  refundedAt: string;
  performedByUserId: number;
}
