import {
  DashboardSummary,
  MenuCategory,
  MenuItem,
  Order,
  OrderStatus,
  OrderType,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Reservation,
  ReservationStatus,
  Table,
  TableStatus,
  User,
  UserRole
} from '../models';

const foodImage = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

export const MOCK_USERS: User[] = [
  {
    id: 1,
    firstName: 'סמיר',
    lastName: 'חלבי',
    email: 'manager@hakeves.test',
    phoneNumber: '050-220-1144',
    role: UserRole.Admin
  },
  {
    id: 2,
    firstName: 'לינה',
    lastName: 'נסראלדין',
    email: 'waiter@hakeves.test',
    phoneNumber: '052-710-8877',
    role: UserRole.Waiter
  },
  {
    id: 3,
    firstName: 'דניאל',
    lastName: 'כהן',
    email: 'customer@hakeves.test',
    phoneNumber: '054-333-9281',
    role: UserRole.Customer
  }
];

export const MOCK_MENU_ITEMS: MenuItem[] = [
  {
    id: 1,
    name: 'סלטי הבית הדרוזיים',
    description: 'מבחר סלטים עונתיים, לבנה, טחינה, ירקות כבושים ופיתות חמות מהטאבון.',
    price: 54,
    category: MenuCategory.Salads,
    isAvailable: true,
    images: [foodImage('photo-1544025162-d76694265947')]
  },
  {
    id: 2,
    name: 'חומוס גרגרים ושמן זית',
    description: 'חומוס קטיפתי, גרגרים חמים, שמן זית גלילי, פפריקה ופלפל ירוק חריף.',
    price: 38,
    category: MenuCategory.Salads,
    isAvailable: true,
    images: [foodImage('photo-1577906096429-f73c2c312435')]
  },
  {
    id: 3,
    name: 'מקלובה כבש חגיגית',
    description: 'אורז מתובל, ירקות קלויים, בשר כבש רך ושקדים קלויים מעל.',
    price: 118,
    category: MenuCategory.MainCourses,
    isAvailable: true,
    images: [foodImage('photo-1543353071-873f17a7a088')]
  },
  {
    id: 4,
    name: 'קבב כבש על גחלים',
    description: 'קבב כבש עסיסי מהגריל, בצל סומאק, עגבניות חרוכות וטחינה הררית.',
    price: 96,
    category: MenuCategory.Meats,
    isAvailable: true,
    images: [foodImage('photo-1555939594-58d7cb561ad1')]
  },
  {
    id: 5,
    name: 'צלעות טלה פרימיום',
    description: 'צלעות טלה מיושנות קלות, עשבי בר, מלח גס ותפוחי אדמה מדורה.',
    price: 168,
    category: MenuCategory.Meats,
    isAvailable: true,
    images: [foodImage('photo-1544025162-d76694265947')]
  },
  {
    id: 6,
    name: 'דג לברק על הגריל',
    description: 'לברק שלם על גחלים, לימון כבוש, עשבי תיבול וסלט ירוק.',
    price: 132,
    category: MenuCategory.Fish,
    isAvailable: true,
    images: [foodImage('photo-1519708227418-c8fd9a32b7a2')]
  },
  {
    id: 7,
    name: 'כנאפה ביתית',
    description: 'כנאפה חמה עם גבינה עדינה, פיסטוק וסירופ מי ורדים.',
    price: 42,
    category: MenuCategory.Desserts,
    isAvailable: true,
    images: [foodImage('photo-1578985545062-69928b1d9587')]
  },
  {
    id: 8,
    name: 'בקלאווה פיסטוק',
    description: 'שכבות בצק פריכות, פיסטוק ושקדים, לצד קפה שחור.',
    price: 34,
    category: MenuCategory.Desserts,
    isAvailable: true,
    images: [foodImage('photo-1608152135912-04a022e23696')]
  },
  {
    id: 9,
    name: 'לימונענע גלילית',
    description: 'לימונים טריים, נענע, קרח כתוש ונגיעה של דבש.',
    price: 22,
    category: MenuCategory.Drinks,
    isAvailable: true,
    images: [foodImage('photo-1621263764928-df1444c5e859')]
  },
  {
    id: 10,
    name: 'קפה שחור עם הל',
    description: 'קפה חזק וארומטי בפינג׳אן, מוגש עם תמרים.',
    price: 16,
    category: MenuCategory.Drinks,
    isAvailable: true,
    images: [foodImage('photo-1514432324607-a09d9b4aefdd')]
  },
  {
    id: 11,
    name: 'מנסף כבש משפחתי',
    description: 'מנה משפחתית עם אורז, יוגורט חמצמץ, שקדים ובשר כבש מפורק.',
    price: 246,
    category: MenuCategory.MainCourses,
    isAvailable: false,
    images: [foodImage('photo-1504674900247-0877df9cc836')]
  }
];

export const MOCK_TABLES: Table[] = [
  { id: 1, name: 'שולחן אבן 1', capacity: 2, status: TableStatus.Available },
  { id: 2, name: 'שולחן חלון 2', capacity: 4, status: TableStatus.Occupied },
  { id: 3, name: 'מרפסת 3', capacity: 4, status: TableStatus.Reserved },
  { id: 4, name: 'משפחה 4', capacity: 8, status: TableStatus.Available },
  { id: 5, name: 'אולם פנימי 5', capacity: 6, status: TableStatus.Occupied },
  { id: 6, name: 'מרפסת נוף 6', capacity: 10, status: TableStatus.Available },
  { id: 7, name: 'VIP כבש 7', capacity: 12, status: TableStatus.Reserved },
  { id: 8, name: 'בר גריל 8', capacity: 3, status: TableStatus.Available }
];

export const MOCK_ORDERS: Order[] = [
  {
    id: 101,
    uniqueIdentifier: 'ORD-20260424-A18',
    orderNumber: 'ORD-20260424121800-0418',
    userId: 2,
    customerFirstName: 'נועה',
    customerLastName: 'רוזן',
    createdAt: '2026-04-24T12:18:00.000Z',
    status: OrderStatus.InSalads,
    notes: 'בלי חריף לילדים, הרבה פיתות.',
    totalPrice: 246,
    orderType: OrderType.DineIn,
    paymentStatus: PaymentStatus.Unpaid,
    tables: [MOCK_TABLES[1]],
    items: [
      { id: 1, menuItemId: 1, menuItemName: 'סלטי הבית הדרוזיים', quantity: 1, unitPrice: 54, lineTotal: 54 },
      { id: 2, menuItemId: 4, menuItemName: 'קבב כבש על גחלים', quantity: 2, unitPrice: 96, lineTotal: 192, notes: 'מידת עשייה מדיום' }
    ]
  },
  {
    id: 102,
    uniqueIdentifier: 'ORD-20260424-A19',
    orderNumber: 'ORD-20260424124100-0419',
    userId: 2,
    customerFirstName: 'אמיר',
    customerLastName: 'חדיד',
    createdAt: '2026-04-24T12:41:00.000Z',
    status: OrderStatus.InMain,
    notes: 'שולחן חוגג יום הולדת.',
    totalPrice: 364,
    orderType: OrderType.DineIn,
    paymentStatus: PaymentStatus.Unpaid,
    tables: [MOCK_TABLES[4]],
    items: [
      { id: 3, menuItemId: 3, menuItemName: 'מקלובה כבש חגיגית', quantity: 2, unitPrice: 118, lineTotal: 236 },
      { id: 4, menuItemId: 7, menuItemName: 'כנאפה ביתית', quantity: 2, unitPrice: 42, lineTotal: 84 },
      { id: 5, menuItemId: 9, menuItemName: 'לימונענע גלילית', quantity: 2, unitPrice: 22, lineTotal: 44 }
    ]
  },
  {
    id: 103,
    uniqueIdentifier: 'ORD-20260424-T02',
    orderNumber: 'ORD-20260424130200-0420',
    userId: 2,
    customerFirstName: 'מיכל',
    customerLastName: 'לוי',
    createdAt: '2026-04-24T13:02:00.000Z',
    status: OrderStatus.Completed,
    notes: 'איסוף עצמי.',
    totalPrice: 142,
    orderType: OrderType.TakeAway,
    paymentStatus: PaymentStatus.Paid,
    tables: [],
    items: [
      { id: 6, menuItemId: 2, menuItemName: 'חומוס גרגרים ושמן זית', quantity: 2, unitPrice: 38, lineTotal: 76 },
      { id: 7, menuItemId: 8, menuItemName: 'בקלאווה פיסטוק', quantity: 1, unitPrice: 34, lineTotal: 34 },
      { id: 8, menuItemId: 10, menuItemName: 'קפה שחור עם הל', quantity: 2, unitPrice: 16, lineTotal: 32 }
    ]
  }
];

export const MOCK_PAYMENTS: Payment[] = [
  {
    id: 9001,
    orderId: 103,
    amount: 142,
    method: PaymentMethod.CreditCard,
    paidAt: '2026-04-24T13:19:00.000Z'
  },
  {
    id: 9002,
    orderId: 96,
    amount: 684,
    method: PaymentMethod.Cash,
    paidAt: '2026-04-24T11:20:00.000Z'
  },
  {
    id: 9003,
    orderId: 94,
    amount: 428,
    method: PaymentMethod.CreditCard,
    paidAt: '2026-04-23T20:44:00.000Z'
  }
];

export const MOCK_RESERVATIONS: Reservation[] = [
  {
    id: 501,
    customerFirstName: 'יואב',
    customerLastName: 'אלון',
    phoneNumber: '050-882-6611',
    reservationDate: '2026-04-24',
    reservationTime: '19:30',
    guestCount: 6,
    notes: 'מבקשים מרפסת אם אפשר.',
    restaurantNotes: 'להכין שולחן ליד הנוף.',
    status: ReservationStatus.Approved,
    createdAt: '2026-04-23T15:20:00.000Z'
  },
  {
    id: 502,
    customerFirstName: 'רונית',
    customerLastName: 'סעד',
    phoneNumber: '052-444-8899',
    reservationDate: '2026-04-24',
    reservationTime: '20:15',
    guestCount: 10,
    notes: 'אירוע משפחתי קטן.',
    restaurantNotes: '',
    status: ReservationStatus.Pending,
    createdAt: '2026-04-24T09:12:00.000Z'
  },
  {
    id: 503,
    customerFirstName: 'כרמל',
    customerLastName: 'פרץ',
    phoneNumber: '054-998-2301',
    reservationDate: '2026-04-25',
    reservationTime: '18:45',
    guestCount: 4,
    notes: 'כיסא תינוק.',
    restaurantNotes: 'לאשר אחרי בדיקת עומס.',
    status: ReservationStatus.Pending,
    createdAt: '2026-04-24T10:38:00.000Z'
  },
  {
    id: 504,
    customerFirstName: 'אילן',
    customerLastName: 'שרון',
    phoneNumber: '053-812-7754',
    reservationDate: '2026-04-23',
    reservationTime: '21:00',
    guestCount: 2,
    notes: '',
    restaurantNotes: 'לא הגיעו.',
    status: ReservationStatus.NoShow,
    createdAt: '2026-04-22T18:07:00.000Z'
  }
];

export const MOCK_DASHBOARD: DashboardSummary = {
  totalRevenueToday: 12480,
  totalRevenueThisMonth: 238920,
  activeOrders: 8,
  completedOrders: 42,
  cancelledOrders: 2,
  unpaidOrders: 5,
  reservationsToday: 18,
  pendingReservations: 7,
  occupiedTables: 2,
  availableTables: 4,
  topDishes: [
    { menuItemId: 5, name: 'צלעות טלה פרימיום', quantity: 36, revenue: 6048 },
    { menuItemId: 4, name: 'קבב כבש על גחלים', quantity: 58, revenue: 5568 },
    { menuItemId: 3, name: 'מקלובה כבש חגיגית', quantity: 31, revenue: 3658 },
    { menuItemId: 1, name: 'סלטי הבית הדרוזיים', quantity: 74, revenue: 3996 }
  ],
  paymentBreakdown: [
    { method: PaymentMethod.CreditCard, amount: 8420, count: 31 },
    { method: PaymentMethod.Cash, amount: 4060, count: 17 }
  ]
};
