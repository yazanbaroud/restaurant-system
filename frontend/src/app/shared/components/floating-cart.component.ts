import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';
import { combineLatest, map, shareReplay, tap } from 'rxjs';

import { UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { CustomerCartLine, CustomerCartService } from '../../core/services/customer-cart.service';

interface FloatingCartViewModel {
  lines: CustomerCartLine[];
  itemCount: number;
  total: number;
  shouldShow: boolean;
}

@Component({
  selector: 'app-floating-cart',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe],
  template: `
    @if (vm$ | async; as vm) {
      @if (vm.shouldShow) {
        <div class="floating-cart-entry" dir="rtl">
          <button
            type="button"
            class="floating-cart-entry__button"
            aria-label="פתיחת עגלת ההזמנה"
            [attr.aria-expanded]="isOpen"
            (click)="open()"
          >
            <span class="floating-cart-entry__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M6.2 6.5h14l-1.4 7.1a2 2 0 0 1-2 1.6H9.3a2 2 0 0 1-2-1.6L5.4 3.8H3" />
                <circle cx="9.5" cy="20" r="1.25" />
                <circle cx="17" cy="20" r="1.25" />
              </svg>
            </span>
            <span class="floating-cart-entry__copy">
              <strong>{{ vm.itemCount }} פריטים</strong>
              <span>{{ vm.total | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
            </span>
            <span class="floating-cart-entry__cta">
              <span class="desktop-label">צפייה בעגלה</span>
              <span class="mobile-label">המשך להזמנה</span>
            </span>
          </button>
        </div>

        @if (isOpen) {
          <button
            type="button"
            class="floating-cart-backdrop"
            aria-label="סגירת העגלה"
            (click)="close()"
          ></button>

          <aside class="floating-cart-drawer" role="dialog" aria-modal="true" aria-label="העגלה שלי" dir="rtl">
            <header class="floating-cart-drawer__header">
              <div>
                <p class="eyebrow">עגלה</p>
                <h2>העגלה שלי</h2>
              </div>
              <button type="button" class="floating-cart-close" aria-label="סגירת העגלה" (click)="close()">×</button>
            </header>

            <div class="floating-cart-lines">
              @for (line of vm.lines; track line.item.id) {
                <article class="floating-cart-line">
                  <div class="floating-cart-line__main">
                    <strong>{{ line.item.name }}</strong>
                    <span>{{ line.quantity }} × {{ line.item.price | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
                  </div>
                  <strong class="floating-cart-line__total">
                    {{ line.item.price * line.quantity | currency: 'ILS' : 'symbol' : '1.0-0' }}
                  </strong>
                  <div class="floating-cart-line__actions">
                    <div class="floating-cart-stepper" aria-label="כמות">
                      <button type="button" aria-label="הפחתת כמות" (click)="decrement(line)">−</button>
                      <span>{{ line.quantity }}</span>
                      <button type="button" aria-label="הגדלת כמות" (click)="increment(line)">+</button>
                    </div>
                    <button type="button" class="floating-cart-remove" (click)="remove(line)">הסרה</button>
                  </div>
                </article>
              }
            </div>

            <footer class="floating-cart-drawer__footer">
              <div class="floating-cart-total">
                <span>סה״כ</span>
                <strong>{{ vm.total | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
              </div>
              <button type="button" class="btn btn-gold full" (click)="goToCart()">מעבר לעגלה</button>
              <button type="button" class="btn btn-ghost full" (click)="close()">המשך להוסיף מנות</button>
            </footer>
          </aside>
        }
      }
    }
  `,
  styles: [`
    .floating-cart-entry {
      position: fixed;
      inset-block-end: 22px;
      inset-inline-start: 22px;
      z-index: 35;
    }

    .floating-cart-entry__button {
      display: grid;
      grid-template-columns: 42px auto auto;
      gap: 12px;
      align-items: center;
      min-width: 278px;
      padding: 12px 14px;
      border: 1px solid rgba(199, 154, 59, 0.46);
      border-radius: var(--radius);
      background: rgba(31, 21, 17, 0.94);
      color: var(--ivory);
      cursor: pointer;
      box-shadow: 0 18px 42px rgba(31, 21, 17, 0.28);
      transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .floating-cart-entry__button:hover {
      transform: translateY(-2px);
      box-shadow: 0 24px 48px rgba(31, 21, 17, 0.34);
    }

    .floating-cart-entry__icon {
      display: inline-grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 999px;
      background: var(--gold);
      color: var(--brown-950);
    }

    .floating-cart-entry__icon svg {
      width: 23px;
      height: 23px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2;
    }

    .floating-cart-entry__copy,
    .floating-cart-entry__cta {
      display: grid;
      gap: 2px;
      text-align: start;
    }

    .floating-cart-entry__copy strong,
    .floating-cart-entry__cta {
      font-weight: 950;
    }

    .floating-cart-entry__copy span {
      color: rgba(255, 248, 237, 0.74);
      font-weight: 850;
    }

    .floating-cart-entry__cta {
      justify-self: end;
      color: var(--gold);
    }

    .mobile-label {
      display: none;
    }

    .floating-cart-backdrop {
      position: fixed;
      inset: 0;
      z-index: 40;
      border: 0;
      background: rgba(31, 21, 17, 0.42);
      cursor: pointer;
    }

    .floating-cart-drawer {
      position: fixed;
      inset-block: 0;
      inset-inline-start: 0;
      z-index: 41;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      width: min(420px, calc(100vw - 34px));
      border-inline-end: 1px solid rgba(199, 154, 59, 0.24);
      background: var(--ivory);
      box-shadow: -22px 0 54px rgba(31, 21, 17, 0.26);
      animation: cartDrawerIn 180ms ease-out;
    }

    .floating-cart-drawer__header,
    .floating-cart-drawer__footer {
      padding: 18px;
      border-color: var(--line);
    }

    .floating-cart-drawer__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      border-bottom: 1px solid var(--line);
    }

    .floating-cart-drawer__header h2 {
      margin: 0;
    }

    .floating-cart-close {
      display: inline-grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.7);
      color: var(--brown-950);
      cursor: pointer;
      font-size: 1.45rem;
      font-weight: 850;
      line-height: 1;
    }

    .floating-cart-lines {
      display: grid;
      align-content: start;
      gap: 10px;
      padding: 14px 18px;
      overflow-y: auto;
    }

    .floating-cart-line {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.76);
    }

    .floating-cart-line__main {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .floating-cart-line__main strong {
      color: var(--brown-950);
    }

    .floating-cart-line__main span {
      color: var(--muted);
      font-weight: 800;
    }

    .floating-cart-line__total {
      color: var(--brown-950);
      white-space: nowrap;
    }

    .floating-cart-line__actions {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .floating-cart-stepper {
      display: inline-grid;
      grid-template-columns: 38px 42px 38px;
      align-items: center;
      justify-items: center;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 255, 255, 0.64);
    }

    .floating-cart-stepper button {
      width: 38px;
      height: 38px;
      border: 0;
      background: rgba(31, 21, 17, 0.08);
      color: var(--brown-950);
      cursor: pointer;
      font-weight: 950;
    }

    .floating-cart-stepper span {
      color: var(--brown-950);
      font-weight: 950;
    }

    .floating-cart-remove {
      border: 0;
      background: transparent;
      color: var(--burgundy);
      cursor: pointer;
      font: inherit;
      font-weight: 900;
    }

    .floating-cart-drawer__footer {
      display: grid;
      gap: 10px;
      border-top: 1px solid var(--line);
      background: rgba(234, 220, 199, 0.4);
    }

    .floating-cart-total {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: var(--brown-950);
      font-weight: 950;
    }

    .floating-cart-total strong {
      font-size: 1.35rem;
    }

    @keyframes cartDrawerIn {
      from {
        opacity: 0;
        transform: translateX(28px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @media (max-width: 720px) {
      .floating-cart-entry {
        inset-inline: 12px;
        inset-block-end: 12px;
      }

      .floating-cart-entry__button {
        grid-template-columns: 1fr auto;
        width: 100%;
        min-width: 0;
        min-height: 64px;
        padding: 10px 12px;
        border-radius: calc(var(--radius) + 2px);
      }

      .floating-cart-entry__icon {
        display: none;
      }

      .floating-cart-entry__copy {
        gap: 0;
      }

      .floating-cart-entry__cta {
        justify-self: end;
      }

      .desktop-label {
        display: none;
      }

      .mobile-label {
        display: inline;
      }

      .floating-cart-drawer {
        inset-block-start: auto;
        inset-inline: 0;
        width: 100%;
        max-height: min(78vh, 640px);
        border-start-start-radius: 18px;
        border-start-end-radius: 18px;
        border-inline-end: 0;
        box-shadow: 0 -22px 54px rgba(31, 21, 17, 0.26);
        animation-name: cartSheetIn;
      }

      .floating-cart-drawer__header,
      .floating-cart-drawer__footer {
        padding: 14px;
      }

      .floating-cart-lines {
        padding: 12px 14px;
      }
    }

    @keyframes cartSheetIn {
      from {
        opacity: 0;
        transform: translateY(28px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `]
})
export class FloatingCartComponent {
  private readonly cart = inject(CustomerCartService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  isOpen = false;

  readonly vm$ = combineLatest([
    this.cart.lines$,
    this.cart.itemCount$,
    this.cart.total$,
    this.auth.currentUser$
  ]).pipe(
    map(([lines, itemCount, total, user]): FloatingCartViewModel => ({
      lines,
      itemCount,
      total,
      shouldShow: user?.role === UserRole.Customer && itemCount > 0
    })),
    tap((vm) => {
      if (!vm.shouldShow) {
        this.isOpen = false;
      }
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  open(): void {
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
  }

  increment(line: CustomerCartLine): void {
    this.cart.updateQuantity(line.item.id, line.quantity + 1);
  }

  decrement(line: CustomerCartLine): void {
    this.cart.updateQuantity(line.item.id, line.quantity - 1);
  }

  remove(line: CustomerCartLine): void {
    this.cart.removeItem(line.item.id);
  }

  goToCart(): void {
    this.close();
    void this.router.navigate(['/cart']);
  }
}
