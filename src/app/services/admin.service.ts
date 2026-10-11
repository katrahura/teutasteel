import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { getToken } from './token-storage';

/** One term somebody typed into the search box, and what came of it. */
export interface SearchRow {
  term: string;
  lang: string | null;
  /** How many products the last search for this term returned. Zero is the interesting number. */
  hits: number;
  times: number;
  last_seen: string | null;
}

export interface SearchReport {
  empty: number;
  total: number;
  searches: SearchRow[];
}

/** What the catalogue holds, how much of it a customer can reach, and what it is missing. */
export interface CatalogueSummary {
  products: {
    total: number;
    active: number;
    in_off_categories: number;
    priced_without_photo: number;
    priced_without_size: number;
  };
  categories: {
    total: number;
    off: number;
    off_titles: string[];
  };
}

/**
 * The owner's own view of the shop.
 *
 * Both of these read records the API had been writing and never reading back: every search has been
 * tallied since the search route was written, and the catalogue's gaps were only visible by asking
 * the database by hand.
 *
 * The refusals are left to the caller: a 401 and a 403 mean different things to this page - not
 * signed in, against signed in without the right - and both are worth saying plainly rather than
 * collapsing into "something went wrong".
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getSearches(limit: number = 100): Observable<SearchReport> {
    return this.http.get<SearchReport>(`${this.baseUrl}/admin/searches?limit=${limit}`, {
      headers: this.authHeaders(),
    });
  }

  getSummary(): Observable<CatalogueSummary> {
    return this.http.get<CatalogueSummary>(`${this.baseUrl}/admin/summary`, {
      headers: this.authHeaders(),
    });
  }

  private authHeaders(): HttpHeaders {
    const token = getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}
