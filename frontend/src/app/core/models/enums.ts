export enum UserRole {
  Admin = 1,
  Waiter = 2,
  Customer = 3
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
  InSalads = 1,
  InMain = 2,
  Completed = 3,
  Cancelled = 4
}

export enum OrderType {
  DineIn = 1,
  TakeAway = 2
}

export enum PaymentStatus {
  Unpaid = 1,
  Paid = 2
}

export enum PaymentMethod {
  Cash = 1,
  CreditCard = 2
}

export enum ReservationStatus {
  Pending = 1,
  Approved = 2,
  Rejected = 3,
  Cancelled = 4,
  Arrived = 5,
  NoShow = 6
}
