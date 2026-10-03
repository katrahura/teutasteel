import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserProfile {
  id?: number;
  username?: string;
  email?: string;
  role?: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getById(id: number): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.baseUrl}/user/${id}`);
  }
}
