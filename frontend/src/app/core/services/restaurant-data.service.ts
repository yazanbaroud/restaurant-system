import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable, of } from 'rxjs';

import {
  MOCK_DASHBOARD,
  MOCK_MENU_ITEMS,
  MOCK_ORDERS,
  MOCK_PAYMENTS,
  MOCK_RESERVATIONS,
  MOCK_TABLES,
  MOCK_USERS
} from '../mock/mock-data';
import {
  CreateOrderInput,
  CreateReservationInput,
  DashboardSummary,
  MenuItem,
  Order,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Reservation,
  ReservationStatus,
  Table,
  TableStatus,
  User
} from '../models';

@Injectable({ providedIn: 'root' })
export class RestaurantDataService {
  private readonly menuSubject = new BehaviorSubject<MenuItem[]>(structuredClone(MOCK_MENU_ITEMS));
  private readonly tablesSubject = new BehaviorSubject<Table[]>(structuredClone(MOCK_TABLES));
  private readonly ordersSubject = new BehaviorSubject<Order[]>(structuredClone(MOCK_ORDERS));
  private readonly reservationsSubject = new BehaviorSubject<Reservation[]>(structuredClone(MOCK_RESERVATIONS));
  private readonly paymentsSubject = new BehaviorSubject<Payment[]>(structuredClone(MOCK_PAYMENTS));
  private readonly usersSubject = new BehaviorSubject<User[]>(structuredClone(MOCK_USERS));

  readonly menuItems$ = this.menuSubject.asObservable();
  readonly tables$ = this.tablesSubject.asObservable();
  readonly orders$ = this.ordersSubject.asObservable();
  readonly reservations$ = this.reservationsSubject.asObservable();
  readonly payments$ = this.paymentsSubject.asObservable();
  readonly users$ = this.usersSubject.asObservable();

  getMenuItems(): Observable<MenuItem[]> {
    return this.menuItems$;
  }

  getAvailableMenuItems(): Observable<MenuItem[]> {
    return this.menuItems$.pipe(map((items) => items.filter((item) => item.isAvailable)));
  }

  getMenuItem(id: number): Observable<MenuItem | undefined> {
    return this.menuItems$.pipe(map((items) => items.find((item) => item.id === id)));
  }

  toggleMenuAvailability(id: number): void {
    this.menuSubject.next(
      this.menuSubject.value.map((item) =>
        item.id === id ? { ...item, isAvailable: !item.isAvailable } : item
      )
    );
  }

  createMenuItem(item: Omit<MenuItem, 'id'>): MenuItem {
    const next: MenuItem = {
      ...item,
      id: this.nextId(this.menuSubject.value)
    };

    this.menuSubject.next([next, ...this.menuSubject.value]);
    return next;
  }

  getTables(): Observable<Table[]> {
    return this.tables$;
  }

  updateTableStatus(id: number, status: TableStatus): void {
    this.tablesSubject.next(
      this.tablesSubject.value.map((table) => (table.id === id ? { ...table, status } : table))
    );
  }

  getOrders(): Observable<Order[]> {
    return this.orders$;
  }

  getOrder(id: number): Observable<Order | undefined> {
    return this.orders$.pipe(map((orders) => orders.find((order) => order.id === id)));
  }

  createOrder(input: CreateOrderInput): Order {
    const items = input.items
      .map((orderItem, index) => {
        const menuItem = this.menuSubject.value.find((candidate) => candidate.id === orderItem.menuItemId);
        if (!menuItem) {
          return null;
        }

        return {
          id: Date.now() + index,
          menuItemId: menuItem.id,
          menuItemName: menuItem.name,
          quantity: orderItem.quantity,
          unitPrice: menuItem.price,
          lineTotal: menuItem.price * orderItem.quantity,
          notes: orderItem.notes
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const selectedTables = this.tablesSubject.value.filter((table) => input.tableIds.includes(table.id));
    const now = new Date();
    const orderNumber = this.createOrderNumber(now);
    const order: Order = {
      id: this.nextId(this.ordersSubject.value),
      uniqueIdentifier: orderNumber,
      orderNumber,
      userId: input.userId ?? null,
      customerFirstName: input.customerFirstName,
      customerLastName: input.customerLastName,
      createdAt: now.toISOString(),
      status: OrderStatus.InSalads,
      notes: input.notes,
      totalPrice: items.reduce((sum, item) => sum + item.lineTotal, 0),
      orderType: input.orderType,
      paymentStatus: PaymentStatus.Unpaid,
      items,
      tables: selectedTables
    };

    this.ordersSubject.next([order, ...this.ordersSubject.value]);
    selectedTables.forEach((table) => this.updateTableStatus(table.id, TableStatus.Occupied));
    return order;
  }

  updateOrderStatus(id: number, status: OrderStatus): void {
    this.ordersSubject.next(
      this.ordersSubject.value.map((order) => (order.id === id ? { ...order, status } : order))
    );
  }

  addPayment(orderId: number, amount: number, method: PaymentMethod): Payment {
    const payment: Payment = {
      id: this.nextId(this.paymentsSubject.value),
      orderId,
      amount,
      method,
      paidAt: new Date().toISOString()
    };

    const payments = [payment, ...this.paymentsSubject.value];
    this.paymentsSubject.next(payments);
    this.ordersSubject.next(
      this.ordersSubject.value.map((order) => {
        if (order.id !== orderId) {
          return order;
        }

        const totalPaid = payments
          .filter((existingPayment) => existingPayment.orderId === orderId)
          .reduce((sum, existingPayment) => sum + existingPayment.amount, 0);

        return {
          ...order,
          paymentStatus: totalPaid >= order.totalPrice ? PaymentStatus.Paid : PaymentStatus.Unpaid
        };
      })
    );
    return payment;
  }

  getReservations(): Observable<Reservation[]> {
    return this.reservations$;
  }

  createReservation(input: CreateReservationInput): Reservation {
    const reservation: Reservation = {
      ...input,
      id: this.nextId(this.reservationsSubject.value),
      restaurantNotes: '',
      status: ReservationStatus.Pending,
      createdAt: new Date().toISOString()
    };

    this.reservationsSubject.next([reservation, ...this.reservationsSubject.value]);
    return reservation;
  }

  updateReservationStatus(id: number, status: ReservationStatus, restaurantNotes = ''): void {
    this.reservationsSubject.next(
      this.reservationsSubject.value.map((reservation) =>
        reservation.id === id
          ? {
              ...reservation,
              status,
              restaurantNotes: restaurantNotes || reservation.restaurantNotes
            }
          : reservation
      )
    );
  }

  getUsers(): Observable<User[]> {
    return this.users$;
  }

  getPayments(): Observable<Payment[]> {
    return this.payments$;
  }

  getDashboardSummary(): Observable<DashboardSummary> {
    return of(this.calculateDashboard());
  }

  private calculateDashboard(): DashboardSummary {
    const orders = this.ordersSubject.value;
    const payments = this.paymentsSubject.value;
    const reservations = this.reservationsSubject.value;
    const tables = this.tablesSubject.value;
    const today = '2026-04-24';
    const month = '2026-04';

    return {
      ...MOCK_DASHBOARD,
      totalRevenueToday: payments
        .filter((payment) => payment.paidAt.startsWith(today))
        .reduce((sum, payment) => sum + payment.amount, 0),
      totalRevenueThisMonth: MOCK_DASHBOARD.totalRevenueThisMonth + payments
        .filter((payment) => payment.paidAt.startsWith(month))
        .reduce((sum, payment) => sum + payment.amount, 0),
      activeOrders: orders.filter((order) => [OrderStatus.InSalads, OrderStatus.InMain].includes(order.status)).length,
      completedOrders: orders.filter((order) => order.status === OrderStatus.Completed).length,
      cancelledOrders: orders.filter((order) => order.status === OrderStatus.Cancelled).length,
      unpaidOrders: orders.filter((order) => order.paymentStatus === PaymentStatus.Unpaid).length,
      reservationsToday: reservations.filter((reservation) => reservation.reservationDate === today).length,
      pendingReservations: reservations.filter((reservation) => reservation.status === ReservationStatus.Pending).length,
      occupiedTables: tables.filter((table) => table.status === TableStatus.Occupied).length,
      availableTables: tables.filter((table) => table.status === TableStatus.Available).length
    };
  }

  private nextId<T extends { id: number }>(items: T[]): number {
    return Math.max(0, ...items.map((item) => item.id)) + 1;
  }

  private createOrderNumber(date: Date): string {
    const timestamp = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
      String(date.getHours()).padStart(2, '0'),
      String(date.getMinutes()).padStart(2, '0'),
      String(date.getSeconds()).padStart(2, '0')
    ].join('');
    const suffix = String(Math.floor(Math.random() * 9000) + 1000);

    return `ORD-${timestamp}-${suffix}`;
  }
}
