import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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
    /** Priced, and no thickness on any row: the price is visible and the product is not. */
    priced_without_thickness: number;
    /** No dimension rows at all: no size, no weight, no price. Nothing a customer can read. */
    no_details: number;
  };
  categories: {
    total: number;
    off: number;
    /** The categories that are switched off, with the ids needed to switch one back on. */
    off_categories: { id: number; title: string }[];
   /** Categories with no image, so the shop's own tiles render as blank cards. */
    without_image: number;
    without_image_titles: string[];
    /** The same categories with their ids, so the panel can link to each one's editor. */
    without_image_categories: { id: number; title: string }[];
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

/** One row of the catalogue table: enough to read at a glance, light enough for fifty of them. */
export interface CatalogueRow {
  id: number;
  code: string;
  is_active: boolean;
  new_product: boolean;
  category_id: number | null;
  category: string | null;
  group: string | null;
  /** Whether the category above it is switched on. A product can be on and still be invisible. */
  category_active: boolean;
  /** Whether there is a photograph somebody can actually see, not merely an image row. */
  has_photo: boolean;
  thumbnail: string | null;
  dimensions_count: number;
  price: number | null;
  currency: string | null;
  thickness: number | null;
  /** The languages that carry a translation, so a missing one is visible in the table. */
  languages: string[];
}

export interface CataloguePage {
  total: number;
  page: number;
  pages: number;
  per_page: number;
  products: CatalogueRow[];
}

/** What the importer answers: what it would do, and what it refused and why. */
export interface ImportLine {
  line: number;
  code: string;
  thickness?: number;
  sizes?: number;
  reason?: string;
}

export interface ImportReport {
  dry_run: boolean;
  applied: ImportLine[];
  rejected: ImportLine[];
  sizes_to_fill: number;
}

/** What the table asks the API for. */
export interface CatalogueQuery {
  q?: string;
  category?: number | null;
  active?: 'all' | '1' | '0';
  page?: number;
  perPage?: number;
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

  /**
   * The catalogue, for the table.
   *
   * Every product, including the ones a customer cannot see: a table that hid the switched-off
   * items could not be used to switch them back on, which is half of why the owner opens it.
   */
  getCatalogue(query: CatalogueQuery): Observable<CataloguePage> {
    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('per_page', String(query.perPage ?? 50))
      .set('active', query.active ?? 'all');
    const term = (query.q || '').trim();
    if (term) {
      params = params.set('q', term);
    }
    if (query.category) {
      params = params.set('category', String(query.category));
    }
    return this.http.get<CataloguePage>(`${this.baseUrl}/admin/catalogue`, {
      headers: this.authHeaders(),
      params,
    });
  }

  /**
   * Copy a product, switched off.
   *
   * An empty body is sent because the API refuses a POST without JSON at all - the app's own rule,
   * not this route's - so a body of nothing is what a client has to send.
   */
  /**
   * Fill in missing thicknesses from a spreadsheet.
   *
   * A preview and an apply are the same call with one flag between them, so what is shown before
   * anything is written is what will happen.
   */
  importThickness(csv: string, dryRun: boolean): Observable<ImportReport> {
    return this.http.post<ImportReport>(
      `${this.baseUrl}/product/import-thickness`,
      { csv, dry_run: dryRun },
      { headers: this.authHeaders() }
    );
  }

  duplicateProduct(id: number): Observable<{ id: number; code: string; is_active: boolean }> {
    return this.http.post<{ id: number; code: string; is_active: boolean }>(
      `${this.baseUrl}/admin/products/${id}/duplicate`,
      {},
      { headers: this.authHeaders() }
    );
  }
}
