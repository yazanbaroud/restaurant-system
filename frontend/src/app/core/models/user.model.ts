import { UserRole } from './enums';

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
}

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
}
