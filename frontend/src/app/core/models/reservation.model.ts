import { ReservationStatus } from './enums';

export interface Reservation {
  id: number;
  customerFirstName: string;
  customerLastName: string;
  phoneNumber: string;
  reservationDate: string;
  reservationTime: string;
  guestCount: number;
  notes: string;
  tableId?: number | null;
  tableName?: string;
  restaurantNotes: string;
  status: ReservationStatus;
  createdAt: string;
}

export interface CreateReservationInput {
  customerFirstName: string;
  customerLastName: string;
  phoneNumber: string;
  reservationDate: string;
  reservationTime: string;
  guestCount: number;
  notes: string;
  tableId?: number | null;
}
