import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';

import { MenuItem, UserRole } from '../models';
import { AuthService } from './auth.service';

const CUSTOMER_CART_STORAGE_PREFIX = 'hakeves.customerCart.';

export interface CustomerCartLine {
  item: MenuItem;
  quantity: number;
  notes: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerCartService {
  private readonly auth = inject(AuthService);
  private readonly linesSubject = new BehaviorSubject<CustomerCartLine[]>([]);
  private storageKey: string | null = null;

  readonly lines$ = this.linesSubject.asObservable();
  readonly itemCount$ = this.lines$.pipe(map((lines) => lines.reduce((sum, line) => sum + line.quantity, 0)));
  readonly total$ = this.lines$.pipe(map((lines) => this.totalFor(lines)));

  constructor() {
    this.auth.currentUser$.subscribe((user) => {
      if (user?.role === UserRole.Customer) {
        this.storageKey = `${CUSTOMER_CART_STORAGE_PREFIX}${user.id}`;
        this.linesSubject.next(this.readStoredCart());
        return;
      }

      this.storageKey = null;
      this.linesSubject.next([]);
    });
  }

  get snapshot(): CustomerCartLine[] {
    return this.linesSubject.value;
  }

  quantityFor(menuItemId: number): number {
    return this.snapshot.find((line) => line.item.id === menuItemId)?.quantity ?? 0;
  }

  addItem(item: MenuItem, quantity = 1): void {
    if (quantity <= 0) {
      return;
    }

    const existing = this.snapshot.find((line) => line.item.id === item.id);
    const next = existing
      ? this.snapshot.map((line) =>
          line.item.id === item.id ? { ...line, item, quantity: line.quantity + quantity } : line
        )
      : [...this.snapshot, { item, quantity, notes: '' }];

    this.commit(next);
  }

  updateQuantity(menuItemId: number, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(menuItemId);
      return;
    }

    this.commit(
      this.snapshot.map((line) =>
        line.item.id === menuItemId ? { ...line, quantity } : line
      )
    );
  }

  updateNotes(menuItemId: number, notes: string): void {
    this.commit(
      this.snapshot.map((line) =>
        line.item.id === menuItemId ? { ...line, notes } : line
      )
    );
  }

  removeItem(menuItemId: number): void {
    this.commit(this.snapshot.filter((line) => line.item.id !== menuItemId));
  }

  clear(): void {
    this.commit([]);
  }

  totalFor(lines: CustomerCartLine[]): number {
    return lines.reduce((sum, line) => sum + line.item.price * line.quantity, 0);
  }

  private commit(lines: CustomerCartLine[]): void {
    this.linesSubject.next(lines);
    this.writeStoredCart(lines);
  }

  private readStoredCart(): CustomerCartLine[] {
    if (!this.storageKey || typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const parsed = JSON.parse(localStorage.getItem(this.storageKey) ?? '[]') as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((value) => this.normalizeLine(value))
        .filter((line): line is CustomerCartLine => Boolean(line));
    } catch {
      return [];
    }
  }

  private writeStoredCart(lines: CustomerCartLine[]): void {
    if (!this.storageKey || typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.storageKey, JSON.stringify(lines));
  }

  private normalizeLine(value: unknown): CustomerCartLine | null {
    const record = this.asRecord(value);
    const item = this.asRecord(record?.['item']);
    const id = Number(item?.['id']);
    const price = Number(item?.['price']);
    const quantity = Number(record?.['quantity']);
    const images = item?.['images'];

    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) {
      return null;
    }

    return {
      item: {
        id,
        name: this.stringValue(item?.['name']),
        description: this.stringValue(item?.['description']),
        price,
        category: Number(item?.['category']) || 0,
        categoryName: this.stringValue(item?.['categoryName']),
        isAvailable: Boolean(item?.['isAvailable'] ?? true),
        images: Array.isArray(images)
          ? images.filter((image): image is string => typeof image === 'string')
          : []
      },
      quantity,
      notes: this.stringValue(record?.['notes'])
    };
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
  }
}
