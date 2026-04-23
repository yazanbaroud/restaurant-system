import { ReservationStatus } from './enums';

export interface Reservation {
  id: number;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  reservationDate: string;
  reservationTime: string;
  guestsCount: number;
  customerNotes: string;
  restaurantNotes: string;
  status: ReservationStatus;
  createdAt: string;
}

export type CreateReservationInput = Omit<Reservation, 'id' | 'status' | 'createdAt' | 'restaurantNotes'>;
