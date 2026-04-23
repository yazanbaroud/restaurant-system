import { PaymentMethod } from './enums';

export interface Payment {
  id: number;
  orderId: number;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
}
