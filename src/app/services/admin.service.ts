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
  /** How many rows this answer carries: the filter is applied before the limit. */
  returned?: number;
  /** Whether the answer was filtered to the terms that found nothing. */
  only_empty?: boolean;
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
    /** The categories that are switched off, with the ids needed to switch one back on. */
    off_categories: { id: number; title: string }[];
  };
}

/** One product on a worklist: enough to find it, not its dimensions and translations as well. */
export interface GapProduct {
  id: number;
  code: string;
  category_id: number | null;
  category: string | null;
  /** The group the sub-category sits in, so a row says where in the catalogue it is. */
  group: string | null;
}

export interface GapPage {
  gap: string;
  total: number;
  page: number;
  pages: number;
  products: GapProduct[];
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

  /**
   * What customers searched for, the terms that found nothing first.
   *
   * With onlyEmpty, just those: a tally of a hundred terms is a report, and the handful nobody
   * could find is a to-do list.
   */
  getSearches(limit: number = 100, onlyEmpty: boolean = false): Observable<SearchReport> {
    const url = `${this.baseUrl}/admin/searches?limit=${limit}${onlyEmpty ? '&only_empty=1' : ''}`;
    return this.http.get<SearchReport>(url, {
      headers: this.authHeaders(),
    });
  }

  getSummary(): Observable<CatalogueSummary> {
    return this.http.get<CatalogueSummary>(`${this.baseUrl}/admin/summary`, {
      headers: this.authHeaders(),
    });
  }

  /**
   * The products behind one of the summary's figures.
   *
   * A figure says how many; the owner needs to know which. The light shape is deliberate - this is
   * a worklist, and a page of full products would be several times its size.
   */
  getGapProducts(gap: string, page: number = 1, perPage: number = 20): Observable<GapPage> {
    const url = `${this.baseUrl}/admin/products?gap=${gap}&page=${page}&per_page=${perPage}`;
    return this.http.get<GapPage>(url, { headers: this.authHeaders() });
  }

  private authHeaders(): HttpHeaders {
    const token = getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}
