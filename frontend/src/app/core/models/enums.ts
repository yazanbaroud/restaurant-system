export enum UserRole {
  Admin = 1,
  Waiter = 2,
  Kitchen = 4,
  Salad = 5
}

export enum TableStatus {
  Available = 1,
  Occupied = 2,
  Reserved = 3
}

export enum MenuCategory {
  Salads = 1,
  MainCourses = 2,
  Fish = 3,
  Meats = 4,
  Desserts = 5,
  Drinks = 6
}

export enum OrderStatus {
  Open = 1,
  Completed = 3,
  Cancelled = 4
}

export enum KitchenStatus {
  InSalads = 1,
  New = InSalads,
  InKitchen = 2,
  Preparing = InKitchen,
  Ready = 3,
  Served = 4
}

export enum OrderItemStatus {
  Pending = 1,
  Preparing = 2,
  Ready = 3
}

export enum OrderType {
  DineIn = 1,
  TakeAway = 2
}

export enum PaymentStatus {
  Unpaid = 1,
  Paid = 2,
  PartiallyPaid = 3,
  Partial = PartiallyPaid,
  Refunded = 4
}

export enum PaymentMethod {
  Cash = 1,
  CreditManual = 2,
  CreditCard = CreditManual,
  Other = 3
}

export enum ReservationStatus {
  Pending = 1,
  Approved = 2,
  Rejected = 3,
  Cancelled = 4,
  Arrived = 5,
  NoShow = 6
}
