import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { clearToken, getToken, getTokenUserId, setToken } from './token-storage';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Login API Call
  login(credentials: { username: string; password: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/login`, credentials);
  }

  // Persist the JWT (SSR-safe: no direct localStorage access here)
  storeToken(token: string): void {
    setToken(token);
  }

  // Check Authentication
  isAuthenticated(): boolean {
    return !!getToken();
  }

  /** Id of the signed-in user, taken from the stored token, or null. */
  currentUserId(): number | null {
    return getTokenUserId();
  }

  // Logout
  logout(): void {
    clearToken();
  }
}
