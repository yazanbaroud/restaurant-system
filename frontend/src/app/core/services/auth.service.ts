import { Injectable } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';

import { MOCK_USERS } from '../mock/mock-data';
import { User, UserRole } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUserSubject = new BehaviorSubject<User>(MOCK_USERS[2]);

  readonly users = MOCK_USERS;
  readonly currentUser$ = this.currentUserSubject.asObservable();
  readonly currentRole$ = this.currentUser$.pipe(map((user) => user.role));

  get currentUser(): User {
    return this.currentUserSubject.value;
  }

  switchRole(role: UserRole): void {
    const nextUser = this.users.find((user) => user.role === role) ?? this.users[2];
    this.currentUserSubject.next(nextUser);
  }

  loginAs(email: string): User {
    const user = this.users.find((candidate) => candidate.email === email) ?? this.users[2];
    this.currentUserSubject.next(user);
    return user;
  }

  registerCustomer(firstName: string, lastName: string, email: string, phoneNumber: string): User {
    const user: User = {
      id: Math.max(...this.users.map((candidate) => candidate.id)) + 1,
      firstName,
      lastName,
      email,
      phoneNumber,
      role: UserRole.Customer
    };

    this.users.push(user);
    this.currentUserSubject.next(user);
    return user;
  }
}
