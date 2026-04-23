import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { MenuItemCardComponent } from '../../shared/components/menu-item-card.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [AsyncPipe, MenuItemCardComponent, RouterLink],
  template: `
    <section class="hero" [style.background-image]="heroBackground">
      <div class="hero__content">
        <p class="eyebrow">דליית אל־כרמל · אירוח דרוזי חם</p>
        <h1>מסעדת הכבש</h1>
        <p>
          חוויית מסעדה יוקרתית וביתית עם גריל כבש, סלטים טריים, תבשילים מסורתיים,
          קפה שחור ונוף של הכרמל.
        </p>
        <div class="actions-inline">
          <a class="btn btn-gold" routerLink="/reservation">הזמנת מקום</a>
          <a class="btn btn-ivory" routerLink="/menu">צפייה בתפריט</a>
        </div>
      </div>
    </section>

    <section class="experience-strip">
      <article>
        <strong>בשר כבש על גחלים</strong>
        <span>חיתוך מוקפד, תיבול עדין, אש פתוחה</span>
      </article>
      <article>
        <strong>סלטים ופתיחה לשולחן</strong>
        <span>צבעים, טחינה, לבנה ופיתות חמות</span>
      </article>
      <article>
        <strong>אירוח משפחתי</strong>
        <span>מתאים לזוגות, משפחות ואירועים אינטימיים</span>
      </article>
    </section>

    <section class="section container">
      <div class="section-heading">
        <p class="eyebrow">מנות מומלצות</p>
        <h2>טעמים של בית עם גימור פרימיום</h2>
        <a class="text-link" routerLink="/menu">כל התפריט</a>
      </div>
      <div class="menu-grid">
        @for (item of featuredMenu$ | async; track item.id) {
          <app-menu-item-card [item]="item" />
        }
      </div>
    </section>

    <section class="story-band">
      <div class="story-band__image">
        <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80" alt="שולחן מסעדה עם אוכל מסורתי" loading="lazy" />
      </div>
      <div class="story-band__content">
        <p class="eyebrow">Hakeves Restaurant</p>
        <h2>מסעדה שמרגישה כמו בית פתוח בכרמל</h2>
        <p>
          אצלנו כל ארוחה נפתחת בשפע סלטים, ממשיכה בגריל כבש על גחלים,
          ומסתיימת בקפה שחור, כנאפה ושיחה טובה מול הכרמל.
        </p>
        <a class="btn btn-dark" routerLink="/reservation">לתיאום ביקור</a>
      </div>
    </section>
  `
})
export class LandingPageComponent {
  private readonly data = inject(RestaurantDataService);

  readonly heroBackground =
    'linear-gradient(90deg, rgba(30, 21, 17, 0.88), rgba(63, 32, 22, 0.56), rgba(63, 32, 22, 0.18)), url("https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=1800&q=80")';
  readonly featuredMenu$ = this.data.getAvailableMenuItems().pipe(map((items) => items.slice(0, 4)));
}
