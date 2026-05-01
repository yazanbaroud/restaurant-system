import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateCustomerOrderInput,
  CustomerOrderItemInput,
  KitchenStatus,
  CustomerTableOption,
  Order,
  OrderItem,
  OrderItemStatus,
  OrderStatus,
  OrderType,
  PaymentStatus,
  Table,
  TableStatus,
  UpdateCustomerOrderInput,
  UpdateCustomerOrderItemInput
} from '../models';

@Injectable({ providedIn: 'root' })
export class CustomerOrdersService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  getOrders(): Observable<Order[]> {
    return this.http.get<unknown[]>(`${this.apiBaseUrl}/api/customer/orders`).pipe(
      map((response) => response.map((order) => this.normalizeOrder(order)))
    );
  }

  getOrder(id: number): Observable<Order> {
    return this.http.get<unknown>(`${this.apiBaseUrl}/api/customer/orders/${id}`).pipe(
      map((response) => this.normalizeOrder(response))
    );
  }

  createOrder(input: CreateCustomerOrderInput): Observable<Order> {
    return this.http.post<unknown>(`${this.apiBaseUrl}/api/customer/orders`, this.orderPayload(input)).pipe(
      map((response) => this.normalizeOrder(response))
    );
  }

  updateOrder(id: number, input: UpdateCustomerOrderInput): Observable<Order> {
    return this.http.put<unknown>(`${this.apiBaseUrl}/api/customer/orders/${id}`, this.orderPayload(input)).pipe(
      map((response) => this.normalizeOrder(response))
    );
  }

  addItem(orderId: number, input: CustomerOrderItemInput): Observable<Order> {
    return this.http.post<unknown>(`${this.apiBaseUrl}/api/customer/orders/${orderId}/items`, input).pipe(
      map((response) => this.normalizeOrder(response))
    );
  }

  updateItem(orderId: number, itemId: number, input: UpdateCustomerOrderItemInput): Observable<Order> {
    return this.http.put<unknown>(`${this.apiBaseUrl}/api/customer/orders/${orderId}/items/${itemId}`, input).pipe(
      map((response) => this.normalizeOrder(response))
    );
  }

  deleteItem(orderId: number, itemId: number): Observable<Order> {
    return this.http.delete<unknown>(`${this.apiBaseUrl}/api/customer/orders/${orderId}/items/${itemId}`).pipe(
      map((response) => this.normalizeOrder(response))
    );
  }

  getAvailableTables(): Observable<CustomerTableOption[]> {
    return this.http.get<unknown[]>(`${this.apiBaseUrl}/api/customer/tables/available`).pipe(
      map((response) => response.map((table) => this.normalizeTableOption(table)))
    );
  }

  private orderPayload(input: CreateCustomerOrderInput | UpdateCustomerOrderInput): Record<string, unknown> {
    return {
      orderType: input.orderType,
      tableId: input.orderType === OrderType.DineIn ? input.tableId ?? null : null,
      notes: input.notes ?? '',
      ...('items' in input ? { items: input.items } : {})
    };
  }

  private normalizeOrder(value: unknown): Order {
    const record = this.asRecord(value) ?? {};

    return {
      id: this.numberValue(record['id']),
      uniqueIdentifier: this.stringValue(record['uniqueIdentifier']),
      orderNumber: this.stringValue(record['orderNumber']),
      userId: record['userId'] === null ? null : this.numberValue(record['userId']),
      customerFirstName: this.stringValue(record['customerFirstName']),
      customerLastName: this.stringValue(record['customerLastName']),
      createdAt: this.stringValue(record['createdAt']),
      status: this.normalizeOrderStatus(record['status']),
      kitchenStatus: this.normalizeKitchenStatus(record['kitchenStatus']),
      notes: this.stringValue(record['notes']),
      totalPrice: this.numberValue(record['totalPrice']),
      orderType: this.normalizeOrderType(record['orderType']),
      paymentStatus: this.normalizePaymentStatus(record['paymentStatus']),
      items: this.arrayValue(record['items']).map((item) => this.normalizeOrderItem(item)),
      tables: this.arrayValue(record['tables']).map((table) => this.normalizeOrderTable(table))
    };
  }

  private normalizeOrderItem(value: unknown): OrderItem {
    const record = this.asRecord(value) ?? {};

    return {
      id: this.numberValue(record['id']),
      menuItemId: this.numberValue(record['menuItemId']),
      menuItemName: this.stringValue(record['menuItemName']),
      quantity: this.numberValue(record['quantity']),
      unitPrice: this.numberValue(record['unitPrice']),
      lineTotal: this.numberValue(record['lineTotal']),
      status: this.normalizeOrderItemStatus(record['status']),
      notes: this.stringValue(record['notes'])
    };
  }

  private normalizeOrderItemStatus(value: unknown): OrderItemStatus {
    const numericValue = Number(value);
    return Object.values(OrderItemStatus).includes(numericValue as OrderItemStatus)
      ? numericValue as OrderItemStatus
      : OrderItemStatus.Pending;
  }

  private normalizeOrderTable(value: unknown): Table {
    const record = this.asRecord(value) ?? {};

    return {
      id: this.numberValue(record['tableId'] ?? record['id']),
      name: this.stringValue(record['tableName'] ?? record['name']),
      capacity: this.numberValue(record['capacity']),
      status: this.normalizeTableStatus(record['status'])
    };
  }

  private normalizeTableOption(value: unknown): CustomerTableOption {
    const record = this.asRecord(value) ?? {};

    return {
      id: this.numberValue(record['id']),
      name: this.stringValue(record['name']),
      capacity: this.numberValue(record['capacity'])
    };
  }

  private normalizeOrderStatus(value: unknown): OrderStatus {
    const numericValue = Number(value);
    return Object.values(OrderStatus).includes(numericValue as OrderStatus) ? numericValue as OrderStatus : OrderStatus.Open;
  }

  private normalizeKitchenStatus(value: unknown): KitchenStatus {
    const numericValue = Number(value);
    return Object.values(KitchenStatus).includes(numericValue as KitchenStatus) ? numericValue as KitchenStatus : KitchenStatus.New;
  }

  private normalizeOrderType(value: unknown): OrderType {
    const numericValue = Number(value);
    return Object.values(OrderType).includes(numericValue as OrderType) ? numericValue as OrderType : OrderType.TakeAway;
  }

  private normalizePaymentStatus(value: unknown): PaymentStatus {
    const numericValue = Number(value);
    return Object.values(PaymentStatus).includes(numericValue as PaymentStatus) ? numericValue as PaymentStatus : PaymentStatus.Unpaid;
  }

  private normalizeTableStatus(value: unknown): TableStatus {
    const numericValue = Number(value);
    return Object.values(TableStatus).includes(numericValue as TableStatus) ? numericValue as TableStatus : TableStatus.Available;
  }

  private numberValue(value: unknown): number {
    const next = Number(value);
    return Number.isFinite(next) ? next : 0;
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private arrayValue(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
  }
}
