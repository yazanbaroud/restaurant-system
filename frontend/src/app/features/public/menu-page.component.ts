import { AsyncPipe } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, map, of, shareReplay, startWith } from 'rxjs';

import { MenuCategory, MenuCategoryRecord, MenuItem, UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { CustomerCartLine, CustomerCartService } from '../../core/services/customer-cart.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { FloatingCartComponent } from '../../shared/components/floating-cart.component';
import { MenuItemCardComponent } from '../../shared/components/menu-item-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { categoryLabels } from '../../shared/ui-labels';

type CategoryFilter = number | 'all';
type SortOption = 'alphabetical' | 'priceAsc' | 'priceDesc';

interface MenuViewModel {
  categories: MenuCategoryRecord[];
  items: MenuItem[];
  totalCount: number;
  visibleCount: number;
  hasSearch: boolean;
  selectedCategoryLabel: string;
  hasError: boolean;
}

@Component({
  selector: 'app-menu-page',
  standalone: true,
  imports: [AsyncPipe, FloatingCartComponent, MenuItemCardComponent, PageHeaderComponent, ReactiveFormsModule, RouterLink],
  template: `
    <section class="container page-surface customer-menu-page">
      <app-page-header
        eyebrow="תפריט"
        title="תפריט מסעדת הכבש"
        subtitle="מנות זמינות להזמנה, מסודרות לפי קטגוריות כדי שתוכלו לבנות ארוחה מהר ובקלות."
      >
        @if (shouldShowCartAction()) {
          <button type="button" class="btn btn-dark" (click)="openCart()">
            העגלה שלי
            @if (cart.itemCount$ | async; as count) {
              @if (count > 0) {
                <span class="menu-cart-count">{{ count }}</span>
              }
            }
          </button>
        }
        <a class="btn btn-gold" routerLink="/reservation">הזמנת מקום</a>
      </app-page-header>

      <div class="menu-toolbar" aria-label="סינון וחיפוש בתפריט">
        <label class="menu-field menu-field--search">
          <span>חיפוש</span>
          <input type="search" [formControl]="searchControl" placeholder="חיפוש מנה או תיאור" />
        </label>

        <label class="menu-field">
          <span>מיון</span>
          <select [formControl]="sortControl">
            <option value="alphabetical">לפי שם</option>
            <option value="priceAsc">מחיר: מהנמוך לגבוה</option>
            <option value="priceDesc">מחיר: מהגבוה לנמוך</option>
          </select>
        </label>
      </div>

      @if (vm$ | async; as vm) {
        <nav class="menu-category-nav" aria-label="קטגוריות תפריט">
          <button type="button" [class.active]="categoryControl.value === 'all'" (click)="selectCategory('all')">
            הכל
          </button>
          @for (category of vm.categories; track category.id) {
            <button
              type="button"
              [class.active]="categoryControl.value === category.id"
              (click)="selectCategory(category.id)"
            >
              {{ category.name }}
            </button>
          }
        </nav>

        <div class="menu-results-line">
          <span>מציג {{ vm.visibleCount }} מתוך {{ vm.totalCount }} מנות · {{ vm.selectedCategoryLabel }}</span>
          @if (vm.hasSearch) {
            <button type="button" class="text-link menu-reset-button" (click)="clearSearch()">ניקוי חיפוש</button>
          }
        </div>

        @if (cartMessage) {
          <p class="success-note menu-feedback" role="status">{{ cartMessage }}</p>
        }

        @if (vm.hasError) {
          <div class="empty-state">
            <h2>לא הצלחנו לטעון את התפריט</h2>
            <p>נסו לרענן את העמוד בעוד רגע.</p>
            <button type="button" class="btn btn-ghost" (click)="reloadPage()">רענון</button>
          </div>
        } @else if (vm.totalCount === 0) {
          <div class="empty-state">
            <h2>אין מנות זמינות כרגע</h2>
            <p>אפשר לבדוק שוב בהמשך או להזמין מקום במסעדה.</p>
          </div>
        } @else if (vm.visibleCount === 0) {
          <div class="empty-state">
            <h2>לא נמצאו מנות מתאימות</h2>
            <p>נסו לשנות את החיפוש או לבחור מיון אחר.</p>
            <button type="button" class="btn btn-ghost" (click)="clearSearch()">ניקוי חיפוש</button>
          </div>
        } @else {
          @if (cart.lines$ | async; as cartLines) {
            <div class="menu-grid customer-menu-grid">
              @for (item of vm.items; track item.id) {
                <app-menu-item-card
                  [item]="item"
                  [showAdd]="shouldShowCartAction()"
                  [showQuantityControls]="canManageCart()"
                  [quantityInCart]="quantityInCart(item.id, cartLines)"
                  [isRecentlyAdded]="lastChangedItemId === item.id"
                  [compact]="true"
                  (add)="addToCart($event)"
                  (increment)="addToCart($event)"
                  (decrement)="decrementItem($event)"
                />
              }
            </div>
          }
        }
      } @else {
        <div class="menu-skeleton-grid" aria-label="טוען תפריט">
          @for (placeholder of skeletonCards; track $index) {
            <div class="menu-skeleton-card"></div>
          }
        </div>
      }
    </section>
    <app-floating-cart />
  `,
  styles: [`
    .customer-menu-page {
      overflow: visible;
    }

    .menu-cart-count {
      display: inline-grid;
      place-items: center;
      min-width: 24px;
      min-height: 24px;
      padding-inline: 7px;
      border-radius: 999px;
      background: var(--gold);
      color: var(--brown-950);
      font-size: 0.78rem;
      font-weight: 950;
    }

    .menu-toolbar {
      display: grid;
      grid-template-columns: minmax(260px, 1fr) minmax(210px, 260px);
      gap: 12px;
      align-items: end;
      margin-bottom: 10px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.72);
    }

    .menu-field {
      display: grid;
      gap: 7px;
      color: var(--brown-950);
      font-weight: 900;
    }

    .menu-field input,
    .menu-field select {
      width: 100%;
      min-height: 44px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 255, 255, 0.82);
      color: var(--brown-950);
      font: inherit;
    }

    .menu-field input {
      padding: 0 14px;
    }

    .menu-field select {
      padding: 0 12px;
      cursor: pointer;
    }

    .menu-category-nav {
      position: sticky;
      top: calc(var(--topbar-height) + 8px);
      z-index: 4;
      display: flex;
      gap: 6px;
      margin-bottom: 10px;
      padding: 8px;
      overflow-x: auto;
      border: 1px solid rgba(199, 154, 59, 0.22);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.94);
      box-shadow: 0 14px 30px rgba(31, 21, 17, 0.08);
      scrollbar-width: thin;
    }

    .menu-category-nav button {
      flex: 0 0 auto;
      min-height: 34px;
      padding: 6px 12px;
      border: 1px solid transparent;
      border-radius: 999px;
      background: transparent;
      color: var(--brown-800);
      cursor: pointer;
      font-weight: 900;
      transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
    }

    .menu-category-nav button.active {
      border-color: rgba(199, 154, 59, 0.48);
      background: rgba(199, 154, 59, 0.2);
      color: var(--brown-950);
    }

    .menu-results-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
      color: var(--muted);
      font-weight: 850;
    }

    .menu-reset-button {
      border: 0;
      background: transparent;
      cursor: pointer;
      font: inherit;
    }

    .menu-feedback {
      margin-bottom: 10px;
      padding: 8px 10px;
      border: 1px solid rgba(102, 112, 68, 0.22);
      border-radius: var(--radius);
      background: rgba(102, 112, 68, 0.1);
    }

    .customer-menu-grid {
      gap: 14px;
    }

    .menu-skeleton-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 18px;
    }

    .menu-skeleton-card {
      min-height: 310px;
      border-radius: var(--radius);
      background: linear-gradient(110deg, rgba(234, 220, 199, 0.55), rgba(255, 248, 237, 0.88), rgba(234, 220, 199, 0.55));
      background-size: 220% 100%;
      animation: menuSkeleton 1.15s ease-in-out infinite;
    }

    @keyframes menuSkeleton {
      from { background-position: 100% 0; }
      to { background-position: -100% 0; }
    }

    @media (max-width: 920px) {
      .menu-toolbar,
      .menu-skeleton-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .menu-toolbar {
        padding: 12px;
      }

      .menu-results-line {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `]
})
export class MenuPageComponent implements OnDestroy {
  private readonly data = inject(RestaurantDataService);
  private readonly auth = inject(AuthService);
  readonly cart = inject(CustomerCartService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);
  private feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly categoryControl = new FormControl<CategoryFilter>('all', { nonNullable: true });
  readonly sortControl = new FormControl<SortOption>('alphabetical', { nonNullable: true });
  readonly skeletonCards = Array.from({ length: 8 });

  readonly vm$ = combineLatest([
    this.data.getAvailableMenuItems(),
    this.data.getMenuCategories(),
    this.searchControl.valueChanges.pipe(
      startWith(this.searchControl.value),
      debounceTime(180),
      map((value) => value.trim().toLowerCase()),
      distinctUntilChanged()
    ),
    this.categoryControl.valueChanges.pipe(startWith(this.categoryControl.value), distinctUntilChanged()),
    this.sortControl.valueChanges.pipe(startWith(this.sortControl.value), distinctUntilChanged())
  ]).pipe(
    map(([items, categories, searchTerm, selectedCategory, sort]) =>
      this.buildViewModel(items, categories, searchTerm, selectedCategory, sort)
    ),
    catchError(() => of(this.errorViewModel())),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  cartMessage = '';
  lastChangedItemId: number | null = null;

  ngOnDestroy(): void {
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }
  }

  selectCategory(category: CategoryFilter): void {
    this.categoryControl.setValue(category);
  }

  clearSearch(): void {
    this.searchControl.setValue('');
  }

  openCart(): void {
    if (!this.canManageCart()) {
      this.redirectToLogin('/cart');
      return;
    }

    void this.router.navigate(['/cart']);
  }

  reloadPage(): void {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  shouldShowCartAction(): boolean {
    const role = this.auth.currentUser?.role;
    return !role || role === UserRole.Customer;
  }

  canManageCart(): boolean {
    return this.auth.currentUser?.role === UserRole.Customer;
  }

  addToCart(item: MenuItem): void {
    if (!this.canManageCart()) {
      this.redirectToLogin();
      return;
    }

    const currentQuantity = this.cart.quantityFor(item.id);
    this.cart.addItem(item);
    this.showCartFeedback(
      item.id,
      currentQuantity
        ? `הכמות של ${item.name} עודכנה ל-${currentQuantity + 1}`
        : `${item.name} נוספה לעגלה`
    );
  }

  decrementItem(item: MenuItem): void {
    if (!this.canManageCart()) {
      this.redirectToLogin();
      return;
    }

    const currentQuantity = this.cart.quantityFor(item.id);
    this.cart.updateQuantity(item.id, currentQuantity - 1);
    this.showCartFeedback(
      item.id,
      currentQuantity > 1
        ? `הכמות של ${item.name} עודכנה ל-${currentQuantity - 1}`
        : `${item.name} הוסרה מהעגלה`
    );
  }

  quantityInCart(menuItemId: number, lines: CustomerCartLine[]): number {
    return lines.find((line) => line.item.id === menuItemId)?.quantity ?? 0;
  }

  private buildViewModel(
    items: MenuItem[],
    categories: MenuCategoryRecord[],
    searchTerm: string,
    selectedCategory: CategoryFilter,
    sort: SortOption
  ): MenuViewModel {
    const displayableItems = this.displayableItems(items, categories);
    const categoryTabs = this.buildCategoryTabs(displayableItems, categories);
    const searchedItems = displayableItems.filter((item) => this.matchesSearch(item, searchTerm));
    const categoryItems = selectedCategory === 'all'
      ? searchedItems
      : searchedItems.filter((item) => item.category === selectedCategory);
    const visibleItems = this.sortItems(categoryItems, sort);

    return {
      categories: categoryTabs,
      items: visibleItems,
      totalCount: displayableItems.length,
      visibleCount: visibleItems.length,
      hasSearch: Boolean(searchTerm),
      selectedCategoryLabel: this.selectedCategoryLabel(selectedCategory, categoryTabs),
      hasError: false
    };
  }

  private errorViewModel(): MenuViewModel {
    return {
      categories: [],
      items: [],
      totalCount: 0,
      visibleCount: 0,
      hasSearch: false,
      selectedCategoryLabel: 'כל הקטגוריות',
      hasError: true
    };
  }

  private displayableItems(items: MenuItem[], categories: MenuCategoryRecord[]): MenuItem[] {
    const knownCategoryIds = new Set(categories.map((category) => category.id));
    const activeCategoryIds = new Set(categories.filter((category) => category.isActive).map((category) => category.id));

    return items.filter((item) => !knownCategoryIds.has(item.category) || activeCategoryIds.has(item.category));
  }

  private matchesSearch(item: MenuItem, searchTerm: string): boolean {
    if (!searchTerm) {
      return true;
    }

    return `${item.name} ${item.description}`.toLowerCase().includes(searchTerm);
  }

  private sortItems(items: MenuItem[], sort: SortOption): MenuItem[] {
    return [...items].sort((first, second) => {
      if (sort === 'priceAsc') {
        return first.price - second.price;
      }

      if (sort === 'priceDesc') {
        return second.price - first.price;
      }

      return first.name.localeCompare(second.name, 'he');
    });
  }

  private buildCategoryTabs(items: MenuItem[], categories: MenuCategoryRecord[]): MenuCategoryRecord[] {
    const activeCategories = categories
      .filter((category) => category.isActive)
      .sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name, 'he'));
    const knownCategoryIds = new Set(categories.map((category) => category.id));
    const categoryTabs = activeCategories.filter((category) => items.some((item) => item.category === category.id));
    const fallbackCategoryIds = [...new Set(items.map((item) => item.category))]
      .filter((categoryId) => !knownCategoryIds.has(categoryId));

    for (const categoryId of fallbackCategoryIds) {
      const categoryItems = items.filter((item) => item.category === categoryId);
      categoryTabs.push({
        id: categoryId,
        name: categoryItems[0]?.categoryName || categoryLabels[categoryId as MenuCategory] || `קטגוריה ${categoryId}`,
        isActive: true,
        sortOrder: 999
      });
    }

    return categoryTabs;
  }

  private selectedCategoryLabel(selectedCategory: CategoryFilter, categories: MenuCategoryRecord[]): string {
    if (selectedCategory === 'all') {
      return 'כל הקטגוריות';
    }

    return categories.find((category) => category.id === selectedCategory)?.name ?? 'קטגוריה נבחרת';
  }

  private showCartFeedback(itemId: number, message: string): void {
    this.cartMessage = message;
    this.lastChangedItemId = itemId;
    this.feedback.success();

    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }

    this.feedbackTimeout = setTimeout(() => {
      this.cartMessage = '';
      this.lastChangedItemId = null;
    }, 2400);
  }

  private redirectToLogin(returnUrl = this.router.url): void {
    this.cartMessage = 'כדי להוסיף מנות לעגלה צריך להתחבר כלקוח.';
    this.feedback.info(this.cartMessage);
    void this.router.navigate(['/login'], {
      queryParams: {
        returnUrl,
        role: UserRole.Customer
      }
    });
  }
}
