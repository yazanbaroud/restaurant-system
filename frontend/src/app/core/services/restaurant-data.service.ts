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
  PaymentBreakdown,
  PaymentMethod,
  PaymentStatus,
  PeakHourReport,
  PeriodReportSummary,
  Reservation,
  ReservationStatus,
  ReservationsReportSummary,
  ReportsSummary,
  SalesReportSummary,
  Table,
  TableOccupancyReport,
  TableStatus,
  TopDish,
  User,
  WaiterPerformanceReport
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
    return this.fetchReservationsFromApi().pipe(switchMap(() => this.reservations$));
  }

  createReservation(input: CreateReservationInput): Observable<Reservation> {
    return this.http.post<unknown>(`${this.apiBaseUrl}/api/Reservations`, this.createReservationPayload(input)).pipe(
      map((response) => this.normalizeReservation(response, input)),
      switchMap((reservation) =>
        this.fetchReservationFromApi(reservation.id).pipe(catchError(() => of(reservation)))
      ),
      catchError(() => of(this.createMockReservation(input))),
      tap((reservation) => this.upsertReservation(reservation))
    );
  }

  updateReservationStatus(id: number, status: ReservationStatus, restaurantNotes = ''): Observable<Reservation> {
    const existingReservation = this.reservationsSubject.value.find((reservation) => reservation.id === id);
    const fallbackReservation: Partial<Reservation> = {
      ...existingReservation,
      id,
      status,
      restaurantNotes: restaurantNotes || existingReservation?.restaurantNotes || ''
    };

    return this.http.put<unknown>(`${this.apiBaseUrl}/api/Reservations/${id}/status`, {
      status,
      restaurantNotes
    }).pipe(
      map((response) => this.normalizeReservation(response, fallbackReservation)),
      switchMap((reservation) =>
        this.fetchReservationFromApi(reservation.id).pipe(catchError(() => of(reservation)))
      ),
      catchError(() => of(this.updateMockReservationStatus(id, status, restaurantNotes))),
      tap((reservation) => this.upsertReservation(reservation))
    );
  }

  private createMockReservation(input: CreateReservationInput): Reservation {
    return {
      ...input,
      id: this.nextId(this.reservationsSubject.value),
      restaurantNotes: '',
      status: ReservationStatus.Pending,
      createdAt: new Date().toISOString()
    };
  }

  private updateMockReservationStatus(id: number, status: ReservationStatus, restaurantNotes = ''): Reservation {
    const reservation = this.reservationsSubject.value.find((candidate) => candidate.id === id);
    if (!reservation) {
      return {
        id,
        customerFirstName: '',
        customerLastName: '',
        phoneNumber: '',
        reservationDate: '',
        reservationTime: '',
        guestCount: 1,
        notes: '',
        restaurantNotes,
        status,
        createdAt: new Date().toISOString()
      };
    }

    return {
      ...reservation,
      status,
      restaurantNotes: restaurantNotes || reservation.restaurantNotes
    };
  }

  private upsertReservation(reservation: Reservation): void {
    const reservations = this.reservationsSubject.value;
    const exists = reservations.some((candidate) => candidate.id === reservation.id);
    this.reservationsSubject.next(
      exists
        ? reservations.map((candidate) => (candidate.id === reservation.id ? reservation : candidate))
        : [reservation, ...reservations]
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
    return this.http.get<unknown>(`${this.apiBaseUrl}/api/Dashboard/admin`).pipe(
      map((response) => this.normalizeDashboardSummary(response, this.calculateDashboard())),
      catchError(() => of(this.calculateDashboard()))
    );
  }

  getReportsSummary(): Observable<ReportsSummary> {
    const defaults = this.createReportDateDefaults();

    return forkJoin({
      daily: this.fetchReport(`daily?date=${defaults.today}`),
      weekly: this.fetchReport(`weekly?weekStart=${defaults.weekStart}`),
      monthly: this.fetchReport(`monthly?year=${defaults.year}&month=${defaults.month}`),
      yearly: this.fetchReport(`yearly?year=${defaults.year}`),
      sales: this.fetchReport(`sales?from=${defaults.monthStart}&to=${defaults.monthEnd}`),
      topDishes: this.fetchReport(`top-dishes?from=${defaults.monthStart}&to=${defaults.monthEnd}&take=10`),
      leastOrdered: this.fetchReport(`least-ordered?from=${defaults.monthStart}&to=${defaults.monthEnd}&take=10`),
      paymentBreakdown: this.fetchReport(`payment-breakdown?from=${defaults.monthStart}&to=${defaults.monthEnd}`),
      peakHours: this.fetchReport(`peak-hours?from=${defaults.monthStart}&to=${defaults.monthEnd}`),
      waiterPerformance: this.fetchReport(`waiter-performance?from=${defaults.monthStart}&to=${defaults.monthEnd}`),
      reservationsSummary: this.fetchReport(`reservations-summary?from=${defaults.monthStart}&to=${defaults.monthEnd}`),
      tableOccupancy: this.fetchReport('table-occupancy')
    }).pipe(
      map((reports) => this.normalizeReportsSummary(reports, this.createFallbackReportsSummary())),
      catchError(() => of(this.createFallbackReportsSummary()))
    );
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

  private createFallbackReportsSummary(): ReportsSummary {
    const dashboard = this.calculateDashboard();
    const ordersCount = dashboard.activeOrders + dashboard.completedOrders + dashboard.cancelledOrders;
    const periodFallback = (totalRevenue: number): PeriodReportSummary => ({
      totalRevenue,
      ordersCount,
      completedOrders: dashboard.completedOrders,
      cancelledOrders: dashboard.cancelledOrders,
      averageOrderValue: ordersCount ? totalRevenue / ordersCount : 0
    });
    const totalTables = dashboard.occupiedTables + dashboard.availableTables;

    return {
      daily: periodFallback(dashboard.totalRevenueToday),
      weekly: periodFallback(dashboard.totalRevenueThisMonth),
      monthly: periodFallback(dashboard.totalRevenueThisMonth),
      yearly: periodFallback(dashboard.totalRevenueThisMonth),
      sales: {
        totalRevenue: dashboard.totalRevenueThisMonth,
        ordersCount,
        itemsSold: dashboard.topDishes.reduce((sum, dish) => sum + dish.quantity, 0),
        averageOrderValue: ordersCount ? dashboard.totalRevenueThisMonth / ordersCount : 0
      },
      topDishes: dashboard.topDishes,
      leastOrdered: dashboard.topDishes.slice().reverse(),
      paymentBreakdown: dashboard.paymentBreakdown,
      peakHours: [],
      waiterPerformance: [],
      reservationsSummary: {
        totalReservations: dashboard.reservationsToday + dashboard.pendingReservations,
        pendingReservations: dashboard.pendingReservations,
        approvedReservations: dashboard.reservationsToday,
        rejectedReservations: 0,
        cancelledReservations: 0,
        arrivedReservations: 0,
        noShowReservations: 0
      },
      tableOccupancy: {
        totalTables,
        occupiedTables: dashboard.occupiedTables,
        availableTables: dashboard.availableTables,
        reservedTables: 0,
        occupancyRate: totalTables ? (dashboard.occupiedTables / totalTables) * 100 : 0
      }
    };
  }

  private fetchReport(pathAndQuery: string): Observable<unknown | null> {
    return this.http.get<unknown>(`${this.apiBaseUrl}/api/Reports/${pathAndQuery}`).pipe(
      catchError(() => of(null))
    );
  }

  private normalizeDashboardSummary(response: unknown, fallback: DashboardSummary): DashboardSummary {
    const record = this.extractReportPayload(response);

    return {
      totalRevenueToday: this.firstNumberValue(
        [record['totalRevenueToday'], record['todayRevenue'], record['revenueToday'], record['dailyRevenue']],
        fallback.totalRevenueToday
      ),
      totalRevenueThisMonth: this.firstNumberValue(
        [record['totalRevenueThisMonth'], record['monthlyRevenue'], record['revenueThisMonth'], record['monthRevenue']],
        fallback.totalRevenueThisMonth
      ),
      activeOrders: this.firstNumberValue([record['activeOrders'], record['activeOrdersCount']], fallback.activeOrders),
      completedOrders: this.firstNumberValue([record['completedOrders'], record['completedOrdersCount']], fallback.completedOrders),
      cancelledOrders: this.firstNumberValue([record['cancelledOrders'], record['cancelledOrdersCount']], fallback.cancelledOrders),
      unpaidOrders: this.firstNumberValue([record['unpaidOrders'], record['unpaidOrdersCount']], fallback.unpaidOrders),
      reservationsToday: this.firstNumberValue([record['reservationsToday'], record['todayReservations']], fallback.reservationsToday),
      pendingReservations: this.firstNumberValue([record['pendingReservations'], record['pendingReservationsCount']], fallback.pendingReservations),
      occupiedTables: this.firstNumberValue([record['occupiedTables'], record['occupiedTablesCount']], fallback.occupiedTables),
      availableTables: this.firstNumberValue([record['availableTables'], record['availableTablesCount']], fallback.availableTables),
      topDishes: this.normalizeTopDishes(record['topDishes'] ?? record['topItems'] ?? record['bestSellingDishes'], fallback.topDishes),
      paymentBreakdown: this.normalizePaymentBreakdown(
        record['paymentBreakdown'] ?? record['paymentsByMethod'],
        fallback.paymentBreakdown
      )
    };
  }

  private normalizeReportsSummary(reports: Record<string, unknown | null>, fallback: ReportsSummary): ReportsSummary {
    return {
      daily: this.normalizePeriodReport(reports['daily'], fallback.daily),
      weekly: this.normalizePeriodReport(reports['weekly'], fallback.weekly),
      monthly: this.normalizePeriodReport(reports['monthly'], fallback.monthly),
      yearly: this.normalizePeriodReport(reports['yearly'], fallback.yearly),
      sales: this.normalizeSalesReport(reports['sales'], fallback.sales),
      topDishes: this.normalizeTopDishes(reports['topDishes'], fallback.topDishes),
      leastOrdered: this.normalizeTopDishes(reports['leastOrdered'], fallback.leastOrdered),
      paymentBreakdown: this.normalizePaymentBreakdown(reports['paymentBreakdown'], fallback.paymentBreakdown),
      peakHours: this.normalizePeakHours(reports['peakHours'], fallback.peakHours),
      waiterPerformance: this.normalizeWaiterPerformance(reports['waiterPerformance'], fallback.waiterPerformance),
      reservationsSummary: this.normalizeReservationsReport(reports['reservationsSummary'], fallback.reservationsSummary),
      tableOccupancy: this.normalizeTableOccupancy(reports['tableOccupancy'], fallback.tableOccupancy)
    };
  }

  private normalizePeriodReport(response: unknown, fallback: PeriodReportSummary): PeriodReportSummary {
    const record = this.extractReportPayload(response);
    const totalRevenue = this.firstNumberValue(
      [record['totalRevenue'], record['revenue'], record['salesTotal'], record['amount'], record['totalSales']],
      fallback.totalRevenue
    );
    const ordersCount = this.firstNumberValue(
      [record['ordersCount'], record['orderCount'], record['totalOrders'], record['completedOrders']],
      fallback.ordersCount
    );

    return {
      totalRevenue,
      ordersCount,
      completedOrders: this.firstNumberValue([record['completedOrders'], record['completedOrdersCount']], fallback.completedOrders),
      cancelledOrders: this.firstNumberValue([record['cancelledOrders'], record['cancelledOrdersCount']], fallback.cancelledOrders),
      averageOrderValue: this.firstNumberValue(
        [record['averageOrderValue'], record['avgOrderValue'], record['averageTicket']],
        ordersCount ? totalRevenue / ordersCount : fallback.averageOrderValue
      )
    };
  }

  private normalizeSalesReport(response: unknown, fallback: SalesReportSummary): SalesReportSummary {
    const record = this.extractReportPayload(response);
    const totalRevenue = this.firstNumberValue(
      [record['totalRevenue'], record['revenue'], record['salesTotal'], record['totalSales']],
      fallback.totalRevenue
    );
    const ordersCount = this.firstNumberValue(
      [record['ordersCount'], record['orderCount'], record['totalOrders'], record['completedOrders']],
      fallback.ordersCount
    );

    return {
      totalRevenue,
      ordersCount,
      itemsSold: this.firstNumberValue([record['itemsSold'], record['totalItemsSold'], record['quantity']], fallback.itemsSold),
      averageOrderValue: this.firstNumberValue(
        [record['averageOrderValue'], record['avgOrderValue'], record['averageTicket']],
        ordersCount ? totalRevenue / ordersCount : fallback.averageOrderValue
      )
    };
  }

  private normalizePeakHours(response: unknown, fallback: PeakHourReport[]): PeakHourReport[] {
    const items = this.extractReportArrayPayload(response, ['peakHours', 'hours', 'items', 'data', 'result']);
    if (!items.length) {
      return fallback;
    }

    return items.map((item) => {
      const record = this.asRecord(item) ?? {};
      const rawHour = record['hour'] ?? record['hourOfDay'] ?? record['time'] ?? record['label'];

      return {
        hour: this.hourLabel(rawHour),
        ordersCount: this.firstNumberValue([record['ordersCount'], record['orderCount'], record['count']], 0),
        revenue: this.firstNumberValue([record['revenue'], record['totalRevenue'], record['amount']], 0)
      };
    });
  }

  private normalizeWaiterPerformance(response: unknown, fallback: WaiterPerformanceReport[]): WaiterPerformanceReport[] {
    const items = this.extractReportArrayPayload(response, ['waiterPerformance', 'waiters', 'items', 'data', 'result']);
    if (!items.length) {
      return fallback;
    }

    return items.map((item, index) => {
      const record = this.asRecord(item) ?? {};
      const totalRevenue = this.firstNumberValue([record['revenue'], record['totalRevenue'], record['sales']], 0);
      const ordersCount = this.firstNumberValue([record['ordersCount'], record['orderCount'], record['completedOrders'], record['count']], 0);

      return {
        waiterId: this.firstNumberValue([record['waiterId'], record['userId'], record['id']], index + 1),
        waiterName: this.stringValue(record['waiterName'] ?? record['userName'] ?? record['name']) || `מלצר ${index + 1}`,
        ordersCount,
        revenue: totalRevenue,
        averageOrderValue: this.firstNumberValue(
          [record['averageOrderValue'], record['avgOrderValue']],
          ordersCount ? totalRevenue / ordersCount : 0
        )
      };
    });
  }

  private normalizeReservationsReport(response: unknown, fallback: ReservationsReportSummary): ReservationsReportSummary {
    const record = this.extractReportPayload(response);

    return {
      totalReservations: this.firstNumberValue(
        [record['totalReservations'], record['reservationsCount'], record['total']],
        fallback.totalReservations
      ),
      pendingReservations: this.firstNumberValue([record['pendingReservations'], record['pendingCount']], fallback.pendingReservations),
      approvedReservations: this.firstNumberValue([record['approvedReservations'], record['approvedCount']], fallback.approvedReservations),
      rejectedReservations: this.firstNumberValue([record['rejectedReservations'], record['rejectedCount']], fallback.rejectedReservations),
      cancelledReservations: this.firstNumberValue([record['cancelledReservations'], record['cancelledCount']], fallback.cancelledReservations),
      arrivedReservations: this.firstNumberValue([record['arrivedReservations'], record['arrivedCount']], fallback.arrivedReservations),
      noShowReservations: this.firstNumberValue([record['noShowReservations'], record['noShowCount'], record['noshowCount']], fallback.noShowReservations)
    };
  }

  private normalizeTableOccupancy(response: unknown, fallback: TableOccupancyReport): TableOccupancyReport {
    const record = this.extractReportPayload(response);
    const occupiedTables = this.firstNumberValue([record['occupiedTables'], record['occupied']], fallback.occupiedTables);
    const availableTables = this.firstNumberValue([record['availableTables'], record['available']], fallback.availableTables);
    const reservedTables = this.firstNumberValue([record['reservedTables'], record['reserved']], fallback.reservedTables);
    const totalTables = this.firstNumberValue(
      [record['totalTables'], record['tablesCount'], record['total']],
      occupiedTables + availableTables + reservedTables
    );

    return {
      totalTables,
      occupiedTables,
      availableTables,
      reservedTables,
      occupancyRate: this.firstNumberValue(
        [record['occupancyRate'], record['occupiedPercentage']],
        totalTables ? (occupiedTables / totalTables) * 100 : fallback.occupancyRate
      )
    };
  }

  private normalizeTopDishes(response: unknown, fallback: TopDish[]): TopDish[] {
    const items = this.extractReportArrayPayload(response, ['topDishes', 'dishes', 'items', 'data', 'result']);
    if (!items.length) {
      return fallback;
    }

    return items.map((item, index) => {
      const record = this.asRecord(item) ?? {};
      const menuItem = this.asRecord(record['menuItem']);
      const menuItemId = this.firstNumberValue([record['menuItemId'], record['dishId'], record['id'], menuItem?.['id']], index + 1);

      return {
        menuItemId,
        name:
          this.stringValue(record['name'] ?? record['menuItemName'] ?? record['dishName'] ?? menuItem?.['name']) ||
          `מנה ${menuItemId}`,
        quantity: this.firstNumberValue([record['quantity'], record['totalQuantity'], record['orderCount'], record['count']], 0),
        revenue: this.firstNumberValue([record['revenue'], record['totalRevenue'], record['amount'], record['sales']], 0)
      };
    });
  }

  private normalizePaymentBreakdown(response: unknown, fallback: PaymentBreakdown[]): PaymentBreakdown[] {
    const items = this.extractReportArrayPayload(response, ['paymentBreakdown', 'paymentsByMethod', 'items', 'data', 'result']);
    if (items.length) {
      return items.map((item) => {
        const record = this.asRecord(item) ?? {};

        return {
          method: this.normalizePaymentMethod(record['method'] ?? record['paymentMethod']),
          amount: this.firstNumberValue([record['amount'], record['totalAmount'], record['revenue'], record['total']], 0),
          count: this.firstNumberValue([record['count'], record['paymentCount'], record['transactions']], 0)
        };
      });
    }

    const record = this.extractReportPayload(response);
    const dictionaryItems = Object.entries(record)
      .filter(([, value]) => typeof value === 'number' || Boolean(this.asRecord(value)))
      .map(([method, value]) => {
        const nested = this.asRecord(value);

        return {
          method: this.normalizePaymentMethod(nested?.['method'] ?? nested?.['paymentMethod'] ?? method),
          amount: this.firstNumberValue([nested?.['amount'], nested?.['totalAmount'], nested?.['revenue'], nested?.['total'], value], 0),
          count: this.firstNumberValue([nested?.['count'], nested?.['paymentCount'], nested?.['transactions']], 0)
        };
      });

    if (!dictionaryItems.length) {
      return fallback;
    }

    return dictionaryItems;
  }

  private extractReportArrayPayload(response: unknown, keys: string[]): unknown[] {
    if (Array.isArray(response)) {
      return response;
    }

    const record = this.asRecord(response);
    if (!record) {
      return [];
    }

    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value;
      }

      const nested = this.asRecord(value);
      if (nested) {
        const nestedItems = this.extractReportArrayPayload(nested, keys);
        if (nestedItems.length) {
          return nestedItems;
        }
      }
    }

    return [];
  }

  private extractReportPayload(response: unknown): Record<string, unknown> {
    const record = this.asRecord(response);
    if (!record) {
      return {};
    }

    for (const key of ['dashboard', 'report', 'summary', 'data', 'result']) {
      const value = this.asRecord(record[key]);
      if (value) {
        return this.extractReportPayload(value);
      }
    }

    return record;
  }

  private createReportDateDefaults(): {
    today: string;
    weekStart: string;
    year: number;
    month: number;
    monthStart: string;
    monthEnd: string;
  } {
    const now = new Date();
    const weekStart = new Date(now);
    const mondayOffset = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - mondayOffset);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      today: this.formatDateOnly(now),
      weekStart: this.formatDateOnly(weekStart),
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      monthStart: this.formatDateOnly(monthStart),
      monthEnd: this.formatDateOnly(monthEnd)
    };
  }

  private formatDateOnly(date: Date): string {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  private hourLabel(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    const hour = Number(value);
    return Number.isFinite(hour) ? `${String(hour).padStart(2, '0')}:00` : '';
  }

  private nextId<T extends { id: number }>(items: T[]): number {
    return Math.max(0, ...items.map((item) => item.id)) + 1;
  }

  private fetchReservationsFromApi(): Observable<Reservation[]> {
    return this.http.get<unknown>(`${this.apiBaseUrl}/api/Reservations`).pipe(
      map((response) => this.normalizeReservations(response)),
      tap((reservations) => this.reservationsSubject.next(reservations)),
      catchError(() => of(this.reservationsSubject.value))
    );
  }

  private fetchReservationFromApi(id: number): Observable<Reservation> {
    return this.http.get<unknown>(`${this.apiBaseUrl}/api/Reservations/${id}`).pipe(
      map((response) => this.normalizeReservation(response))
    );
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

  private normalizeReservations(response: unknown): Reservation[] {
    return this.extractReservationArrayPayload(response).map((reservation) => this.normalizeReservation(reservation));
  }

  private normalizeReservation(response: unknown, fallback: Partial<Reservation> = {}): Reservation {
    const record = this.extractReservationPayload(response) ?? {};
    const fallbackRecord = fallback as Record<string, unknown>;
    const tableRecord = this.asRecord(record['table']);

    return {
      id: this.numberValue(record['id'], fallback.id ?? this.nextId(this.reservationsSubject.value)),
      customerFirstName:
        this.stringValue(record['customerFirstName'] ?? record['firstName']) ||
        fallback.customerFirstName ||
        this.stringValue(fallbackRecord['firstName']) ||
        '',
      customerLastName:
        this.stringValue(record['customerLastName'] ?? record['lastName']) ||
        fallback.customerLastName ||
        this.stringValue(fallbackRecord['lastName']) ||
        '',
      phoneNumber:
        this.stringValue(record['phoneNumber'] ?? record['phone']) ||
        fallback.phoneNumber ||
        '',
      reservationDate:
        this.stringValue(record['reservationDate'] ?? record['date']) ||
        fallback.reservationDate ||
        '',
      reservationTime:
        this.stringValue(record['reservationTime'] ?? record['time']) ||
        fallback.reservationTime ||
        '',
      guestCount: this.numberValue(
        record['guestCount'] ?? record['guestsCount'],
        fallback.guestCount ?? this.numberValue(fallbackRecord['guestsCount'], 1)
      ),
      notes:
        this.stringValue(record['notes'] ?? record['customerNotes']) ||
        fallback.notes ||
        this.stringValue(fallbackRecord['customerNotes']) ||
        '',
      tableId: this.nullableNumberValue(record['tableId'] ?? tableRecord?.['id'] ?? fallback.tableId),
      tableName:
        this.stringValue(record['tableName'] ?? tableRecord?.['name']) ||
        fallback.tableName,
      restaurantNotes:
        this.stringValue(record['restaurantNotes']) ||
        fallback.restaurantNotes ||
        '',
      status: this.normalizeReservationStatus(record['status'] ?? fallback.status),
      createdAt:
        this.stringValue(record['createdAt'] ?? record['createdOn']) ||
        fallback.createdAt ||
        new Date().toISOString()
    };
  }

  private createReservationPayload(input: CreateReservationInput): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      customerFirstName: input.customerFirstName,
      customerLastName: input.customerLastName,
      phoneNumber: input.phoneNumber,
      reservationDate: input.reservationDate,
      reservationTime: input.reservationTime,
      guestCount: input.guestCount,
      notes: input.notes
    };

    if (input.tableId != null) {
      payload['tableId'] = input.tableId;
    }

    return payload;
  }

  private extractReservationArrayPayload(response: unknown): unknown[] {
    if (Array.isArray(response)) {
      return response;
    }

    const record = this.asRecord(response);
    if (!record) {
      return [];
    }

    for (const key of ['reservations', 'items', 'data', 'result']) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value;
      }

      const nested = this.asRecord(value);
      if (nested) {
        const nestedReservations = this.extractReservationArrayPayload(nested);
        if (nestedReservations.length) {
          return nestedReservations;
        }
      }
    }

    return [];
  }

  private extractReservationPayload(response: unknown): Record<string, unknown> | null {
    const record = this.asRecord(response);
    if (!record) {
      return null;
    }

    if ('id' in record || 'customerFirstName' in record || 'firstName' in record || 'reservationDate' in record) {
      return record;
    }

    for (const key of ['reservation', 'data', 'result']) {
      const value = this.asRecord(record[key]);
      if (value) {
        const nestedReservation = this.extractReservationPayload(value);
        if (nestedReservation) {
          return nestedReservation;
        }
      }
    }

    return record;
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

  private normalizeReservationStatus(value: unknown): ReservationStatus {
    const numericValue = this.numberValue(value);
    if (this.isReservationStatus(numericValue)) {
      return numericValue;
    }

    if (typeof value === 'string') {
      const statusName = value.toLowerCase();
      const status = Object.values(ReservationStatus)
        .filter((candidate): candidate is ReservationStatus => typeof candidate === 'number')
        .find((candidate) => ReservationStatus[candidate].toLowerCase() === statusName);

      if (status) {
        return status;
      }
    }

    return ReservationStatus.Pending;
  }

  private normalizePaymentMethod(value: unknown): PaymentMethod {
    const numericValue = this.numberValue(value);
    if (this.isPaymentMethod(numericValue)) {
      return numericValue;
    }

    if (typeof value === 'string') {
      const methodName = value.toLowerCase().replace(/[\s_-]/g, '');
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

  private isReservationStatus(value: number): value is ReservationStatus {
    return Object.values(ReservationStatus).includes(value);
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

  private firstNumberValue(values: unknown[], fallback = 0): number {
    for (const value of values) {
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
    }

    return fallback;
  }

  private nullableNumberValue(value: unknown): number | null {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
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
