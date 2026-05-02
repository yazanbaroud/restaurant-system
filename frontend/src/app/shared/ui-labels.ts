import {
  KitchenStatus,
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
  [UserRole.Kitchen]: 'מטבח',
  [UserRole.Salad]: 'סלטיה'
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
  [OrderStatus.Open]: 'פעילה',
  [OrderStatus.Completed]: 'הושלם',
  [OrderStatus.Cancelled]: 'בוטל'
};

export const orderStatusTones: Record<OrderStatus, BadgeTone> = {
  [OrderStatus.Open]: 'gold',
  [OrderStatus.Completed]: 'charcoal',
  [OrderStatus.Cancelled]: 'danger'
};

export const kitchenStatusLabels: Record<KitchenStatus, string> = {
  [KitchenStatus.InSalads]: 'בסלטיה',
  [KitchenStatus.InKitchen]: 'מטבח פנימי',
  [KitchenStatus.Ready]: 'מוכנה',
  [KitchenStatus.Served]: 'הוגשה'
};

export const kitchenStatusTones: Record<KitchenStatus, BadgeTone> = {
  [KitchenStatus.InSalads]: 'gold',
  [KitchenStatus.InKitchen]: 'olive',
  [KitchenStatus.Ready]: 'beige',
  [KitchenStatus.Served]: 'charcoal'
};

export const orderTypeLabels: Record<OrderType, string> = {
  [OrderType.DineIn]: 'ישיבה במסעדה',
  [OrderType.TakeAway]: 'איסוף עצמי'
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  [PaymentStatus.Unpaid]: 'לא שולם',
  [PaymentStatus.Paid]: 'שולם',
  [PaymentStatus.PartiallyPaid]: 'שולם חלקית',
  [PaymentStatus.Refunded]: 'הוחזר'
};

export const paymentStatusTones: Record<PaymentStatus, BadgeTone> = {
  [PaymentStatus.Unpaid]: 'burgundy',
  [PaymentStatus.Paid]: 'olive',
  [PaymentStatus.PartiallyPaid]: 'gold',
  [PaymentStatus.Refunded]: 'charcoal'
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.Cash]: 'מזומן',
  [PaymentMethod.CreditManual]: 'אשראי ידני',
  [PaymentMethod.Other]: 'אחר'
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
