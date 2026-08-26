export type UserRole = 'CUSTOMER' | 'ORGANISER' | 'ADMIN' | 'USER' | 'THEATRE_ADMIN' | 'SUPER_ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt?: string;
}

export type EventType = 'MOVIE' | 'CONCERT' | 'PLAY' | 'STANDUP';

export interface Movie {
  id: string;
  title: string;
  description?: string;
  eventType: EventType;
  duration: number;
  genre?: string[];
  language: string;
  rating?: string;
  posterUrl?: string;
  trailerUrl?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface Theatre {
  id: string;
  name: string;
  slug: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  adminId?: string;
  primaryColor?: string;
  accentColor?: string;
  isActive?: boolean;
}

export interface SeatType {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export type SeatRuntimeStatus = 'AVAILABLE' | 'HELD' | 'BOOKED' | 'BLOCKED' | 'MAINTENANCE';

export interface Seat {
  id: string;
  screenId: string;
  seatTypeId?: string;
  row: number;
  col: number;
  label: string;
  rowLabel?: string;
  status: SeatRuntimeStatus;
  isGolden: boolean;
  isAccessible: boolean;
  price: number;
  customPrice?: number;
  seatType?: SeatType;
}

export interface CategoryStat {
  seatTypeId: string;
  seatTypeName: string;
  color: string;
  total: number;
  available: number;
  held: number;
  booked: number;
  isSoldOut: boolean;
}

export interface Screen {
  id: string;
  theatreId: string;
  name: string;
  capacity: number;
  rows: number;
  cols: number;
  theatre?: Theatre;
  seats?: Seat[];
}

export interface Show {
  id: string;
  screenId: string;
  movieId: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  movie?: Movie;
  screen?: Screen;
  categoryStats?: CategoryStat[];
}

export interface BookingSeat {
  id: string;
  seatId: string;
  price: number;
  seat?: {
    id: string;
    label: string;
    seatType?: {
      name: string;
    };
  };
}

export interface Payment {
  amount: number;
  status: string;
  gateway?: string;
}

export interface Booking {
  id: string;
  bookingRef: string;
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED';
  qrCode?: string;
  notificationStatus?: 'MOCK_SENT' | 'SENT' | 'FAILED';
  createdAt: string;
  show?: {
    id: string;
    startTime: string;
    movie?: {
      id: string;
      title: string;
      eventType?: string;
    };
    screen?: {
      id: string;
      name: string;
      theatre?: {
        id: string;
        name: string;
        city?: string;
      };
    };
  };
  seats: BookingSeat[];
  payment?: Payment;
}

export interface WaitlistEntry {
  id: string;
  userId: string;
  showId: string;
  seatTypeId: string;
  status: 'PENDING' | 'OFFER_PENDING' | 'FULFILLED' | 'EXPIRED' | 'CANCELLED';
  offeredSeatId?: string;
  offerExpiresAt?: string;
  queuePosition?: number;
  isOfferExpired?: boolean;
  createdAt: string;
  show?: {
    id: string;
    startTime: string;
    movie?: {
      id: string;
      title: string;
    };
    screen?: {
      id: string;
      name: string;
      theatre?: {
        id: string;
        name: string;
      };
    };
  };
  seatType?: {
    id: string;
    name: string;
    color: string;
  };
  offeredSeat?: {
    id: string;
    label: string;
  };
}
