import { PaymentBreakdown, TopDish } from './dashboard.model';

export interface PeriodReportSummary {
  totalRevenue: number;
  ordersCount: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
}

export interface SalesReportSummary {
  totalRevenue: number;
  ordersCount: number;
  itemsSold: number;
  averageOrderValue: number;
}

export interface PeakHourReport {
  hour: string;
  ordersCount: number;
  revenue: number;
}

export interface WaiterPerformanceReport {
  waiterId: number;
  waiterName: string;
  ordersCount: number;
  revenue: number;
  averageOrderValue: number;
}

export interface ReservationsReportSummary {
  totalReservations: number;
  pendingReservations: number;
  approvedReservations: number;
  rejectedReservations: number;
  cancelledReservations: number;
  arrivedReservations: number;
  noShowReservations: number;
}

export interface TableOccupancyReport {
  totalTables: number;
  occupiedTables: number;
  availableTables: number;
  reservedTables: number;
  occupancyRate: number;
}

export interface ReportsSummary {
  daily: PeriodReportSummary;
  weekly: PeriodReportSummary;
  monthly: PeriodReportSummary;
  yearly: PeriodReportSummary;
  sales: SalesReportSummary;
  topDishes: TopDish[];
  leastOrdered: TopDish[];
  paymentBreakdown: PaymentBreakdown[];
  peakHours: PeakHourReport[];
  waiterPerformance: WaiterPerformanceReport[];
  reservationsSummary: ReservationsReportSummary;
  tableOccupancy: TableOccupancyReport;
}
