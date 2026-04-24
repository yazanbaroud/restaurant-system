import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
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
  CreateOrderItemInput,
  CreateReservationInput,
  DashboardSummary,
  MenuCategory,
  MenuItem,
  Order,
  OrderItem,
  OrderStatus,
  OrderType,
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
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;
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
    return this.fetchMenuItemsFromApi().pipe(switchMap(() => this.menuItems$));
  }

  getAvailableMenuItems(): Observable<MenuItem[]> {
    return this.getMenuItems().pipe(map((items) => items.filter((item) => item.isAvailable)));
  }

  getMenuItem(id: number): Observable<MenuItem | undefined> {
    return this.http.get<unknown>(`${this.apiBaseUrl}/api/Menu/${id}`).pipe(
      map((response) => this.normalizeMenuItem(response)),
      tap((item) => this.upsertMenuItem(item)),
      catchError(() => this.menuItems$.pipe(map((items) => items.find((item) => item.id === id))))
    );
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
    return this.fetchOrdersFromApi().pipe(switchMap(() => this.orders$));
  }

  getOrder(id: number): Observable<Order | undefined> {
    return this.fetchOrderFromApi(id).pipe(
      switchMap(() => this.orders$.pipe(map((orders) => orders.find((order) => order.id === id)))),
      catchError(() => this.orders$.pipe(map((orders) => orders.find((order) => order.id === id))))
    );
  }

  createOrder(input: CreateOrderInput): Observable<Order> {
    return this.http.post<unknown>(`${this.apiBaseUrl}/api/Orders`, this.createOrderPayload(input)).pipe(
      map((response) => this.normalizeOrder(response, input)),
      catchError(() => of(this.createMockOrder(input))),
      tap((order) => {
        this.upsertOrder(order);
        this.markOrderTablesOccupied(order, input.tableIds);
      })
    );
  }

  private createMockOrder(input: CreateOrderInput): Order {
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

    return order;
  }

  updateOrderStatus(id: number, status: OrderStatus): Observable<Order> {
    const existingLocalOrder = this.ordersSubject.value.find((candidate) => candidate.id === id);

    return this.http.put<unknown>(`${this.apiBaseUrl}/api/Orders/${id}/status`, { status }).pipe(
      map((response) => ({
        order: this.normalizeOrder(response),
        isFallback: false
      })),
      catchError(() =>
        of({
          order: this.updateMockOrderStatus(id, status),
          isFallback: true
        })
      ),
      tap((result) => {
        this.upsertOrder(result.order);

        if (result.isFallback) {
          return;
        }

        this.syncTablesFromOrder(result.order);

        if (
          existingLocalOrder &&
          this.shouldReleaseTables(status) &&
          this.hasMissingReleasedTableState(result.order, existingLocalOrder)
        ) {
          this.releaseOrderTables(existingLocalOrder);
        }
      }),
      map((result) => result.order)
    );
  }

  private updateMockOrderStatus(id: number, status: OrderStatus): Order {
    const order = this.ordersSubject.value.find((candidate) => candidate.id === id);
    const updatedOrder = order ? { ...order, status } : this.createMissingMockOrder(id, status);

    if (order && this.shouldReleaseTables(status)) {
      this.releaseOrderTables(order);
    }

    return updatedOrder;
  }

  private createMissingMockOrder(id: number, status: OrderStatus): Order {
    const now = new Date();
    const orderNumber = this.createOrderNumber(now);

    return {
      id,
      uniqueIdentifier: orderNumber,
      orderNumber,
      userId: null,
      customerFirstName: '',
      customerLastName: '',
      createdAt: now.toISOString(),
      status,
      notes: '',
      totalPrice: 0,
      orderType: OrderType.DineIn,
      paymentStatus: PaymentStatus.Unpaid,
      items: [],
      tables: []
    };
  }

  addPayment(orderId: number, amount: number, method: PaymentMethod): Observable<Payment> {
    return this.http.post<unknown>(`${this.apiBaseUrl}/api/Payments`, this.createPaymentPayload(orderId, amount, method)).pipe(
      map((response) => {
        const orderPayload = this.extractNestedObject(response, ['order']);
        return {
          payment: this.normalizePayment(response, { orderId, amount, method }),
          backendOrder: orderPayload ? this.normalizeOrder(orderPayload) : null,
          isFallback: false
        };
      }),
      catchError(() =>
        of({
          payment: this.addMockPayment(orderId, amount, method),
          backendOrder: null,
          isFallback: true
        })
      ),
      tap((result) => {
        if (result.backendOrder) {
          this.upsertOrder(result.backendOrder);
        }

        this.upsertPayment(result.payment);

        if (result.isFallback) {
          this.updateMockOrderPaymentStatus(orderId);
        }
      }),
      switchMap((result) =>
        result.isFallback
          ? of(result.payment)
          : forkJoin({
              payments: this.fetchPaymentsForOrderFromApi(orderId).pipe(catchError(() => of(this.paymentsSubject.value))),
              order: this.fetchOrderFromApi(orderId).pipe(catchError(() => of(null)))
            }).pipe(map(() => result.payment))
      )
    );
  }

  private addMockPayment(orderId: number, amount: number, method: PaymentMethod): Payment {
    const payment: Payment = {
      id: this.nextId(this.paymentsSubject.value),
      orderId,
      amount,
      method,
      paidAt: new Date().toISOString()
    };

    return payment;
  }

  private updateMockOrderPaymentStatus(orderId: number): void {
    this.ordersSubject.next(
      this.ordersSubject.value.map((order) => {
        if (order.id !== orderId) {
          return order;
        }

        const totalPaid = this.getTotalPaidForOrder(this.paymentsSubject.value, orderId);

        return {
          ...order,
          paymentStatus: totalPaid >= order.totalPrice ? PaymentStatus.Paid : PaymentStatus.Unpaid
        };
      })
    );
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
    return this.fetchPaymentsFromApi().pipe(switchMap(() => this.payments$));
  }

  getPaymentsForOrder(orderId: number): Observable<Payment[]> {
    return this.fetchPaymentsForOrderFromApi(orderId).pipe(
      switchMap(() => this.orderPaymentsFromState(orderId)),
      catchError(() => this.orderPaymentsFromState(orderId))
    );
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

  private fetchOrdersFromApi(): Observable<Order[]> {
    return this.http.get<unknown>(`${this.apiBaseUrl}/api/Orders`).pipe(
      map((response) => this.normalizeOrders(response)),
      tap((orders) => this.ordersSubject.next(orders)),
      catchError(() => of(this.ordersSubject.value))
    );
  }

  private fetchOrderFromApi(id: number): Observable<Order> {
    return this.http.get<unknown>(`${this.apiBaseUrl}/api/Orders/${id}`).pipe(
      map((response) => this.normalizeOrder(response)),
      tap((order) => this.upsertOrder(order))
    );
  }

  private fetchPaymentsFromApi(): Observable<Payment[]> {
    return this.http.get<unknown>(`${this.apiBaseUrl}/api/Payments`).pipe(
      map((response) => this.normalizePayments(response)),
      tap((payments) => this.paymentsSubject.next(payments)),
      catchError(() => of(this.paymentsSubject.value))
    );
  }

  private fetchPaymentsForOrderFromApi(orderId: number): Observable<Payment[]> {
    return this.http.get<unknown>(`${this.apiBaseUrl}/api/Payments/order/${orderId}`).pipe(
      map((response) => this.normalizePayments(response, orderId)),
      tap((payments) => this.replacePaymentsForOrder(orderId, payments))
    );
  }

  private orderPaymentsFromState(orderId: number): Observable<Payment[]> {
    return this.payments$.pipe(
      map((payments) =>
        [...payments]
          .filter((payment) => payment.orderId === orderId)
          .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
      )
    );
  }

  private normalizePayments(response: unknown, fallbackOrderId?: number): Payment[] {
    return this.extractArrayPayload(response).map((payment) => this.normalizePayment(payment, { orderId: fallbackOrderId }));
  }

  private normalizePayment(
    response: unknown,
    fallback: { orderId?: number; amount?: number; method?: PaymentMethod } = {}
  ): Payment {
    const record = this.extractPaymentPayload(response) ?? {};

    return {
      id: this.numberValue(record['id'], this.nextId(this.paymentsSubject.value)),
      orderId: this.numberValue(record['orderId'], fallback.orderId ?? 0),
      amount: this.numberValue(record['amount'], fallback.amount ?? 0),
      method: this.normalizePaymentMethod(record['method'] ?? record['paymentMethod'] ?? fallback.method),
      paidAt: this.stringValue(record['paidAt'] ?? record['createdAt']) || new Date().toISOString()
    };
  }

  private extractPaymentPayload(response: unknown): Record<string, unknown> | null {
    const record = this.asRecord(response);
    if (!record) {
      return null;
    }

    if ('amount' in record || 'paymentMethod' in record || 'paidAt' in record) {
      return record;
    }

    for (const key of ['payment', 'data', 'result']) {
      const value = this.asRecord(record[key]);
      if (value) {
        const nestedPayment = this.extractPaymentPayload(value);
        if (nestedPayment) {
          return nestedPayment;
        }
      }
    }

    return null;
  }

  private createPaymentPayload(orderId: number, amount: number, method: PaymentMethod): {
    orderId: number;
    amount: number;
    method: PaymentMethod;
  } {
    return { orderId, amount, method };
  }

  private upsertPayment(payment: Payment): void {
    const payments = this.paymentsSubject.value;
    const exists = payments.some((candidate) => candidate.id === payment.id);
    this.paymentsSubject.next(exists ? payments.map((candidate) => (candidate.id === payment.id ? payment : candidate)) : [payment, ...payments]);
  }

  private replacePaymentsForOrder(orderId: number, payments: Payment[]): void {
    const otherPayments = this.paymentsSubject.value.filter((payment) => payment.orderId !== orderId);
    this.paymentsSubject.next([...payments, ...otherPayments]);
  }

  private normalizeOrders(response: unknown): Order[] {
    return this.extractArrayPayload(response).map((order) => this.normalizeOrder(order));
  }

  private normalizeOrder(response: unknown, fallbackInput?: CreateOrderInput): Order {
    const record = this.extractObjectPayload(response) ?? {};
    const items = this.normalizeOrderItems(this.extractArrayValue(record, ['items', 'orderItems']), fallbackInput);
    const tables = this.normalizeOrderTables(this.extractArrayValue(record, ['tables', 'orderTables']), fallbackInput);
    const totalPrice = this.numberValue(
      record['totalPrice'] ?? record['total'],
      items.reduce((sum, item) => sum + item.lineTotal, 0)
    );
    const createdAt = this.stringValue(record['createdAt'] ?? record['createdOn']) || new Date().toISOString();
    const orderNumber = this.stringValue(record['orderNumber'] ?? record['uniqueIdentifier']) || this.createOrderNumber(new Date(createdAt));

    return {
      id: this.numberValue(record['id'], this.nextId(this.ordersSubject.value)),
      uniqueIdentifier: this.stringValue(record['uniqueIdentifier']) || orderNumber,
      orderNumber,
      userId: record['userId'] == null ? fallbackInput?.userId ?? null : this.numberValue(record['userId']),
      customerFirstName: this.stringValue(record['customerFirstName']) || fallbackInput?.customerFirstName || '',
      customerLastName: this.stringValue(record['customerLastName']) || fallbackInput?.customerLastName || '',
      createdAt,
      status: this.normalizeOrderStatus(record['status']),
      notes: this.stringValue(record['notes']) || fallbackInput?.notes || '',
      totalPrice,
      orderType: this.normalizeOrderType(record['orderType'] ?? fallbackInput?.orderType),
      paymentStatus: this.normalizePaymentStatus(record['paymentStatus']),
      items,
      tables
    };
  }

  private normalizeOrderItems(rawItems: unknown[], fallbackInput?: CreateOrderInput): OrderItem[] {
    if (rawItems.length) {
      return rawItems.map((item, index) => this.normalizeOrderItem(item, index));
    }

    return (fallbackInput?.items ?? []).map((item, index) => this.createOrderItemFromInput(item, index));
  }

  private normalizeOrderItem(value: unknown, index: number): OrderItem {
    const record = this.asRecord(value) ?? {};
    const nestedMenuItem = this.asRecord(record['menuItem']);
    const quantity = this.numberValue(record['quantity'], 1);
    const unitPrice = this.numberValue(record['unitPrice'] ?? record['price']);
    const lineTotal = this.numberValue(record['lineTotal'] ?? record['totalPrice'], unitPrice * quantity);
    const menuItemId = this.numberValue(record['menuItemId'] ?? nestedMenuItem?.['id']);

    return {
      id: this.numberValue(record['id'], Date.now() + index),
      menuItemId,
      menuItemName:
        this.stringValue(record['menuItemName'] ?? record['name'] ?? nestedMenuItem?.['name']) ||
        `מנה ${menuItemId}`,
      quantity,
      unitPrice,
      lineTotal,
      notes: this.stringValue(record['notes'])
    };
  }

  private createOrderItemFromInput(item: CreateOrderItemInput, index: number): OrderItem {
    const menuItem = this.menuSubject.value.find((candidate) => candidate.id === item.menuItemId);
    const unitPrice = menuItem?.price ?? 0;

    return {
      id: Date.now() + index,
      menuItemId: item.menuItemId,
      menuItemName: menuItem?.name ?? `מנה ${item.menuItemId}`,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
      notes: item.notes
    };
  }

  private normalizeOrderTables(rawTables: unknown[], fallbackInput?: CreateOrderInput): Table[] {
    if (rawTables.length) {
      return rawTables.map((table) => this.normalizeOrderTable(table));
    }

    return this.tablesSubject.value.filter((table) => fallbackInput?.tableIds.includes(table.id) ?? false);
  }

  private normalizeOrderTable(value: unknown): Table {
    const record = this.asRecord(value) ?? {};
    const nestedTable = this.asRecord(record['table']);
    const tableRecord = nestedTable ?? record;
    const id = this.numberValue(tableRecord['id'] ?? record['tableId']);

    return {
      id,
      name: this.stringValue(tableRecord['name'] ?? record['tableName']) || `שולחן ${id}`,
      capacity: this.numberValue(tableRecord['capacity']),
      status: this.normalizeTableStatus(tableRecord['status'])
    };
  }

  private createOrderPayload(input: CreateOrderInput): CreateOrderInput {
    return {
      userId: input.userId ?? null,
      customerFirstName: input.customerFirstName,
      customerLastName: input.customerLastName,
      notes: input.notes,
      orderType: input.orderType,
      tableIds: input.tableIds,
      items: input.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes
      }))
    };
  }

  private upsertOrder(order: Order): void {
    const orders = this.ordersSubject.value;
    const exists = orders.some((candidate) => candidate.id === order.id);
    this.ordersSubject.next(exists ? orders.map((candidate) => (candidate.id === order.id ? order : candidate)) : [order, ...orders]);
  }

  private markOrderTablesOccupied(order: Order, fallbackTableIds: number[] = []): void {
    const tableIds = new Set([...order.tables.map((table) => table.id), ...fallbackTableIds]);
    this.tablesSubject.next(
      this.tablesSubject.value.map((table) =>
        tableIds.has(table.id) ? { ...table, status: TableStatus.Occupied } : table
      )
    );
  }

  private syncTablesFromOrder(order: Order): void {
    if (!order.tables.length) {
      return;
    }

    const orderTables = new Map(order.tables.map((table) => [table.id, table]));
    this.tablesSubject.next(
      this.tablesSubject.value.map((table) => {
        const backendTable = orderTables.get(table.id);
        return backendTable ? { ...table, ...backendTable } : table;
      })
    );
  }

  private hasMissingReleasedTableState(backendOrder: Order, localOrder: Order): boolean {
    if (!localOrder.tables.length) {
      return false;
    }

    const backendTables = new Map(backendOrder.tables.map((table) => [table.id, table]));
    return localOrder.tables.some((table) => backendTables.get(table.id)?.status !== TableStatus.Available);
  }

  private fetchMenuItemsFromApi(): Observable<MenuItem[]> {
    return this.http.get<unknown>(`${this.apiBaseUrl}/api/Menu`).pipe(
      map((response) => this.normalizeMenuItems(response)),
      tap((items) => this.menuSubject.next(items)),
      catchError(() => of(this.menuSubject.value))
    );
  }

  private normalizeMenuItems(response: unknown): MenuItem[] {
    const rawItems = this.extractArrayPayload(response);
    return rawItems.map((item) => this.normalizeMenuItem(item));
  }

  private normalizeMenuItem(response: unknown): MenuItem {
    const record = this.asRecord(response) ?? {};

    return {
      id: this.numberValue(record['id']),
      name: this.stringValue(record['name']),
      description: this.stringValue(record['description']),
      price: this.numberValue(record['price']),
      category: this.normalizeMenuCategory(record['category']),
      isAvailable: this.booleanValue(record['isAvailable'], true),
      images: this.normalizeImages(record['images'] ?? record['imageUrls'] ?? record['imageUrl'])
    };
  }

  private extractArrayPayload(response: unknown): unknown[] {
    if (Array.isArray(response)) {
      return response;
    }

    const record = this.asRecord(response);
    for (const key of ['items', 'data', 'result', 'menuItems']) {
      const value = record?.[key];
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [];
  }

  private extractObjectPayload(response: unknown): Record<string, unknown> | null {
    const record = this.asRecord(response);
    if (!record) {
      return null;
    }

    if ('id' in record || 'orderNumber' in record || 'name' in record) {
      return record;
    }

    for (const key of ['data', 'result', 'order']) {
      const value = this.asRecord(record[key]);
      if (value) {
        return value;
      }
    }

    return record;
  }

  private extractNestedObject(response: unknown, keys: string[]): Record<string, unknown> | null {
    const record = this.asRecord(response);
    if (!record) {
      return null;
    }

    for (const key of keys) {
      const value = this.asRecord(record[key]);
      if (value) {
        return value;
      }
    }

    const data = this.asRecord(record['data']);
    if (data) {
      return this.extractNestedObject(data, keys);
    }

    return null;
  }

  private extractArrayValue(record: Record<string, unknown>, keys: string[]): unknown[] {
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [];
  }

  private upsertMenuItem(item: MenuItem): void {
    const items = this.menuSubject.value;
    const exists = items.some((candidate) => candidate.id === item.id);
    this.menuSubject.next(exists ? items.map((candidate) => (candidate.id === item.id ? item : candidate)) : [item, ...items]);
  }

  private normalizeImages(value: unknown): string[] {
    if (Array.isArray(value)) {
      const imageUrls = value
        .map((image, index) => ({
          index,
          isMainImage: this.booleanValue(this.asRecord(image)?.['isMainImage'], false),
          imageUrl: this.extractImageUrl(image)
        }))
        .filter((image): image is { index: number; isMainImage: boolean; imageUrl: string } => Boolean(image.imageUrl))
        .sort((a, b) => Number(b.isMainImage) - Number(a.isMainImage) || a.index - b.index)
        .map((image) => image.imageUrl);

      return imageUrls.length ? imageUrls : this.defaultMenuImages();
    }

    const imageUrl = this.extractImageUrl(value);
    return imageUrl ? [imageUrl] : this.defaultMenuImages();
  }

  private extractImageUrl(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    const record = this.asRecord(value);
    return this.stringValue(record?.['imageUrl']).trim();
  }

  private defaultMenuImages(): string[] {
    return ['https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80'];
  }

  private booleanValue(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  private normalizeMenuCategory(value: unknown): MenuCategory {
    const numericValue = this.numberValue(value);
    if (this.isMenuCategory(numericValue)) {
      return numericValue;
    }

    if (typeof value === 'string') {
      const categoryName = value.toLowerCase();
      const category = Object.values(MenuCategory)
        .filter((candidate): candidate is MenuCategory => typeof candidate === 'number')
        .find((candidate) => MenuCategory[candidate].toLowerCase() === categoryName);

      if (category) {
        return category;
      }
    }

    return MenuCategory.MainCourses;
  }

  private isMenuCategory(value: number): value is MenuCategory {
    return Object.values(MenuCategory).includes(value);
  }

  private normalizeOrderStatus(value: unknown): OrderStatus {
    const numericValue = this.numberValue(value);
    if (this.isOrderStatus(numericValue)) {
      return numericValue;
    }

    if (typeof value === 'string') {
      const statusName = value.toLowerCase();
      const status = Object.values(OrderStatus)
        .filter((candidate): candidate is OrderStatus => typeof candidate === 'number')
        .find((candidate) => OrderStatus[candidate].toLowerCase() === statusName);

      if (status) {
        return status;
      }
    }

    return OrderStatus.InSalads;
  }

  private normalizeOrderType(value: unknown): OrderType {
    const numericValue = this.numberValue(value);
    if (this.isOrderType(numericValue)) {
      return numericValue;
    }

    if (typeof value === 'string') {
      const typeName = value.toLowerCase();
      const orderType = Object.values(OrderType)
        .filter((candidate): candidate is OrderType => typeof candidate === 'number')
        .find((candidate) => OrderType[candidate].toLowerCase() === typeName);

      if (orderType) {
        return orderType;
      }
    }

    return OrderType.DineIn;
  }

  private normalizePaymentStatus(value: unknown): PaymentStatus {
    const numericValue = this.numberValue(value);
    if (this.isPaymentStatus(numericValue)) {
      return numericValue;
    }

    if (typeof value === 'string') {
      const statusName = value.toLowerCase();
      const status = Object.values(PaymentStatus)
        .filter((candidate): candidate is PaymentStatus => typeof candidate === 'number')
        .find((candidate) => PaymentStatus[candidate].toLowerCase() === statusName);

      if (status) {
        return status;
      }
    }

    return PaymentStatus.Unpaid;
  }

  private normalizePaymentMethod(value: unknown): PaymentMethod {
    const numericValue = this.numberValue(value);
    if (this.isPaymentMethod(numericValue)) {
      return numericValue;
    }

    if (typeof value === 'string') {
      const methodName = value.toLowerCase();
      const method = Object.values(PaymentMethod)
        .filter((candidate): candidate is PaymentMethod => typeof candidate === 'number')
        .find((candidate) => PaymentMethod[candidate].toLowerCase() === methodName);

      if (method) {
        return method;
      }
    }

    return PaymentMethod.CreditCard;
  }

  private normalizeTableStatus(value: unknown): TableStatus {
    const numericValue = this.numberValue(value);
    if (this.isTableStatus(numericValue)) {
      return numericValue;
    }

    if (typeof value === 'string') {
      const statusName = value.toLowerCase();
      const status = Object.values(TableStatus)
        .filter((candidate): candidate is TableStatus => typeof candidate === 'number')
        .find((candidate) => TableStatus[candidate].toLowerCase() === statusName);

      if (status) {
        return status;
      }
    }

    return TableStatus.Occupied;
  }

  private isOrderStatus(value: number): value is OrderStatus {
    return Object.values(OrderStatus).includes(value);
  }

  private isOrderType(value: number): value is OrderType {
    return Object.values(OrderType).includes(value);
  }

  private isPaymentStatus(value: number): value is PaymentStatus {
    return Object.values(PaymentStatus).includes(value);
  }

  private isPaymentMethod(value: number): value is PaymentMethod {
    return Object.values(PaymentMethod).includes(value);
  }

  private isTableStatus(value: number): value is TableStatus {
    return Object.values(TableStatus).includes(value);
  }

  private numberValue(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  }

  private getTotalPaidForOrder(payments: Payment[], orderId: number): number {
    return payments
      .filter((payment) => payment.orderId === orderId)
      .reduce((sum, payment) => sum + payment.amount, 0);
  }

  private shouldReleaseTables(status: OrderStatus): boolean {
    return status === OrderStatus.Completed || status === OrderStatus.Cancelled;
  }

  private releaseOrderTables(order: Order): void {
    const tableIds = new Set(order.tables.map((table) => table.id));

    this.tablesSubject.next(
      this.tablesSubject.value.map((table) =>
        tableIds.has(table.id) ? { ...table, status: TableStatus.Available } : table
      )
    );
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
