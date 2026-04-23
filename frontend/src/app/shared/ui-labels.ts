import {
  MenuCategory,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
  TableStatus,
  UserRole
} from '../core/models';

export type BadgeTone = 'gold' | 'olive' | 'burgundy' | 'charcoal' | 'beige' | 'danger';

export const roleLabels: Record<UserRole, string> = {
  [UserRole.Admin]: 'מנהל',
  [UserRole.Waiter]: 'מלצר',
  [UserRole.Customer]: 'לקוח'
};

export const categoryLabels: Record<MenuCategory, string> = {
  [MenuCategory.Salads]: 'סלטים',
  [MenuCategory.MainCourses]: 'עיקריות',
  [MenuCategory.Fish]: 'דגים',
  [MenuCategory.Meats]: 'בשרים',
  [MenuCategory.Desserts]: 'קינוחים',
  [MenuCategory.Drinks]: 'שתייה'
};

export const tableStatusLabels: Record<TableStatus, string> = {
  [TableStatus.Available]: 'פנוי',
  [TableStatus.Occupied]: 'תפוס',
  [TableStatus.Reserved]: 'שמור'
};

export const tableStatusTones: Record<TableStatus, BadgeTone> = {
  [TableStatus.Available]: 'olive',
  [TableStatus.Occupied]: 'burgundy',
  [TableStatus.Reserved]: 'gold'
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  [OrderStatus.InSalads]: 'בסלטים',
  [OrderStatus.InMain]: 'בעיקריות',
  [OrderStatus.Completed]: 'הושלם',
  [OrderStatus.Cancelled]: 'בוטל'
};

export const orderStatusTones: Record<OrderStatus, BadgeTone> = {
  [OrderStatus.InSalads]: 'gold',
  [OrderStatus.InMain]: 'olive',
  [OrderStatus.Completed]: 'charcoal',
  [OrderStatus.Cancelled]: 'danger'
};

export const orderTypeLabels: Record<OrderType, string> = {
  [OrderType.DineIn]: 'ישיבה במסעדה',
  [OrderType.TakeAway]: 'איסוף עצמי'
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  [PaymentStatus.Unpaid]: 'לא שולם',
  [PaymentStatus.Paid]: 'שולם'
};

export const paymentStatusTones: Record<PaymentStatus, BadgeTone> = {
  [PaymentStatus.Unpaid]: 'burgundy',
  [PaymentStatus.Paid]: 'olive'
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.Cash]: 'מזומן',
  [PaymentMethod.CreditCard]: 'אשראי'
};

export const reservationStatusLabels: Record<ReservationStatus, string> = {
  [ReservationStatus.Pending]: 'ממתין',
  [ReservationStatus.Approved]: 'מאושר',
  [ReservationStatus.Rejected]: 'נדחה',
  [ReservationStatus.Cancelled]: 'בוטל',
  [ReservationStatus.Arrived]: 'הגיע',
  [ReservationStatus.NoShow]: 'לא הגיע'
};

export const reservationStatusTones: Record<ReservationStatus, BadgeTone> = {
  [ReservationStatus.Pending]: 'gold',
  [ReservationStatus.Approved]: 'olive',
  [ReservationStatus.Rejected]: 'danger',
  [ReservationStatus.Cancelled]: 'charcoal',
  [ReservationStatus.Arrived]: 'beige',
  [ReservationStatus.NoShow]: 'burgundy'
};
