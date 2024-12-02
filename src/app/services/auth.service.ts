import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // private baseUrl = 'https://api.teutasteel.com/auth/login'; // Replace with your backend URL
  private baseUrl = 'http://127.0.0.1:5000'; // Replace with your backend URL

  constructor(private http: HttpClient) {}

  // Login API Call
  login(credentials: { username: string; password: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/login`, credentials);
  }

  // Check Authentication
  isAuthenticated(): boolean {
    const token = localStorage.getItem('token');
    return !!token; // Return true if the token exists
  }

  // Logout
  logout(): void {
    localStorage.removeItem('token');
  }
}
