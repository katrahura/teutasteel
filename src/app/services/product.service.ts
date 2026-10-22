import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { catchError, mergeMap, Observable, of, retryWhen, throwError, map } from 'rxjs';
import { Category, CategoryResponse, ImageAsset, Product, TopCategory } from '../models/product.model';
import { environment } from '../../environments/environment';
import { getToken } from './token-storage';
/**
 * What the API actually said, flattened into one line.
 *
 * A refused save comes back as `{"error": "Validation error", "details": {"dimensions": {"0":
 * {"price": ["Missing data for required field."]}}}}`, and the panel used to be told only that
 * something went wrong. This walks that shape - however deeply the schema nests it - and names the
 * field.
 *
 * A plain function rather than a method, because `handleError` is handed to `catchError` as a
 * reference: there is no `this` inside it, and reaching for one threw
 * "Cannot read properties of undefined". The tests caught that before it went anywhere.
 */
function explainApiError(error: HttpErrorResponse): string {
  const body = (error && error.error) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return '';
  }
  const problems = (body['details'] ?? body['validation_errors'] ?? null) as unknown;
  if (!problems) {
    return typeof body['error'] === 'string' ? (body['error'] as string) : '';
  }
  const lines: string[] = [];
  const walk = (value: unknown, path: string[]): void => {
    if (value === null || value === undefined) {
      return;
    }
    if (typeof value === 'string') {
      lines.push((path.length ? path.join('.') + ': ' : '') + value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => walk(entry, path));
      return;
    }
    if (typeof value === 'object') {
      Object.keys(value as Record<string, unknown>)
        .forEach((key) => walk((value as Record<string, unknown>)[key], path.concat(key)));
    }
  };
  walk(problems, []);
  return lines.slice(0, 6).join(' · ');
}

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private apiUrl = environment.apiUrl;
  private cloudinaryBaseUrl = environment.cloudinaryBaseUrl;


  constructor(private http: HttpClient) {}

  /**
   * Retries only the failures that can plausibly succeed on a second attempt:
   * network errors (status 0) and server errors (5xx).
   *
   * A 4xx never will. The live API still answers 404 for /category/top, so with an
   * unconditional retry(4) every visitor's home page and products page fired five
   * requests at an endpoint that cannot work, and logged five failures.
   */
  private retryTransient<T>(attempts = 4) {
    return retryWhen<T>((errors) =>
      errors.pipe(
        mergeMap((error: HttpErrorResponse, index: number) => {
          const status = error?.status ?? 0;
          const worthRetrying = status === 0 || status >= 500;
          return worthRetrying && index < attempts ? of(error) : throwError(() => error);
        })
      )
    );
  }

  // Method to get all categories
  getCategories(): Observable<Category[]> {
    const url = `${this.apiUrl}/category/`;
    return this.http
      .get<Category[]>(url, { headers: this.getAuthHeaders() })
      .pipe(
        this.retryTransient(),
        map((categories) =>
          this.transformCategories(categories, 'category_images')
        ), // Transform the response
        catchError(this.handleError)
      );
  }
  getCategoryChildren(parentId: number): Observable<Category[]> {
  const url = `${this.apiUrl}/category/${parentId}/children`;
  return this.http
    .get<Category[]>(url, { headers: this.getAuthHeaders() })
    .pipe(
      this.retryTransient(),
      map((cats) => this.transformCategories(cats, 'category_images')),
      catchError(this.handleError)
    );
}

  getTopCategories(): Observable<TopCategory[]> {
      const url = `${this.apiUrl}/category/top`;    return this.http
      .get<TopCategory[]>(url, { headers: this.getAuthHeaders() })
      .pipe(this.retryTransient(),
      map((categories) =>
        this.transformCategories(categories, 'category_images')
      ), // Transform the response
      catchError(this.handleError)
    );
  }

  /**
   * The same six groups, each with its children and their product counts.
   *
   * A separate method from getTopCategories on purpose: that one is called all over the app and its
   * endpoint is relied on, but /category/top carries no children - and the products live in the
   * children, not the groups. Decorative metal holds none of its own, so asking its id for products
   * returns nothing. Only the tree can answer "what is actually in this group".
   */
  getCategoryTree(): Observable<TopCategory[]> {
    const url = `${this.apiUrl}/category/tree`;
    return this.http
      .get<TopCategory[]>(url, { headers: this.getAuthHeaders() })
      .pipe(this.retryTransient(),
        map((categories) => this.transformCategories(categories, 'category_images')),
        catchError(this.handleError)
      );
  }

  /**
   * Four priced products for the home page's featured row.
   *
   * One call. The page used to fetch the tree, choose the busiest sub-categories and then ask for
   * each of them on its own - thirteen round trips for four cards, which is where the homepage's
   * second of waiting went.
   */
  getFeatured(lang: string = 'al'): Observable<{ products: Product[] }> {
    const url = `${this.apiUrl}/category/featured?lang=${lang}`;
    return this.http.get<{ products: Product[] }>(url).pipe(
      this.retryTransient(),
      map((response) => ({
        products: ((response && response.products) || []).map((product) =>
          this.withDeliveredImage(product, 'product_images')
        ),
      })),
      catchError(this.handleError)
    );
  }

  createCategory(category: Category): Observable<Category> {
    const headers = this.getAuthHeaders(); // Get authorization headers
    return this.http.post<Category>(`${this.apiUrl}/category/create`, category, { headers });
  }
  
  createProduct(product: Product): Observable<Product> {
    const headers = this.getAuthHeaders(); // Get authorization headers
    const sanitizedProduct = this.sanitizePayload(product);
    return this.http.post<Product>(`${this.apiUrl}/product/create`, sanitizedProduct, { headers });
  }
  /**
   * Top-level categories, and - when the endpoint is the tree - their children as well.
   *
   * The children are shown as cards with photographs of their own on the products page, and the tree
   * carries them inline. Transforming only the outer array left every sub-category image pointing at
   * a bare path, which is what the page would have rendered the moment it stopped asking for the
   * children separately.
   */
  private transformCategories(
    categories: Category[],
    folder: string
  ): Category[] {
    return categories.map((category) => {
      const delivered = this.withDeliveredImage(category, folder) as Category & {
        children?: Category[];
      };
      return delivered.children
        ? {
            ...delivered,
            children: delivered.children.map((child) => this.withDeliveredImage(child, folder)),
          }
        : delivered;
    });
  }

  private transformProducts(category: CategoryResponse, folder: string): CategoryResponse {
    return {
      ...category,
      products: (category.products || []).map((product) =>
        this.withDeliveredImage(product, folder)
      ),
    };
  }

  /**
   * Returns a copy carrying the Cloudinary delivery URLs. The response objects
   * used to be mutated in place, so anything holding the same object saw the
   * prefix applied twice.
   *
   * Empty paths stay empty: an image row with no paths (which the admin form
   * used to create for every new product) must fall through to the placeholder
   * instead of becoming a URL that points at nothing.
   */
  private deliveryUrl(value: string, folder: string): string {
    const path = value.trim();
    if (/^https?:\/\//i.test(path)) return path;
    const relative = path.replace(/^\/+/, '');
    return this.cloudinaryBaseUrl + '/' + (relative.startsWith(folder + '/') ? relative : folder + '/' + relative);
  }

  private withDeliveredImage<T extends { image_asset?: ImageAsset }>(
    item: T,
    folder: string
  ): T {
    const asset = item.image_asset;
    if (!asset) {
      return item;
    }

    const delivered: ImageAsset = { ...asset };
    if (asset.original_path) {
      delivered.original_path = this.deliveryUrl(asset.original_path, folder);
    }
    if (asset.thumbnail_path) {
      delivered.thumbnail_path = this.deliveryUrl(asset.thumbnail_path, folder);
    }

    const hasImage = !!(
      asset.file_name ||
      asset.original_path ||
      asset.thumbnail_path
    );
    return { ...item, image_asset: hasImage ? delivered : undefined };
  }
  // Method to get a single category by ID, including its products


  /**
   * One category and a page of its products, optionally narrowed.
   *
   * The filters are sent only when they were chosen: an empty filter in the address would come back
   * as a narrowed list with nothing to explain why. The API applies every condition to the same
   * size row, so a 2 mm tube is one whose own thickness is 2 mm.
   */
  getCategoryById(
    category_id: number,
    page: number = 1,
    perPage: number = 8,
    lang: string = 'en',
    filters: {
      thickness?: number | null;
      minHeight?: number | null;
      maxHeight?: number | null;
    } = {}
  ): Observable<CategoryResponse> {
    const query = [`page=${page}`, `per_page=${perPage}`, `lang=${lang}`];
    if (filters.thickness != null) {
      query.push(`thickness=${filters.thickness}`);
    }
    if (filters.minHeight != null) {
      query.push(`min_height=${filters.minHeight}`);
    }
    if (filters.maxHeight != null) {
      query.push(`max_height=${filters.maxHeight}`);
    }
    const url = `${this.apiUrl}/category/${category_id}?${query.join('&')}`;
    return this.http.get<CategoryResponse>(url, { headers: this.getAuthHeaders() })
      .pipe(
        this.retryTransient(),
        map((CategoryResponse) =>
          this.transformProducts(CategoryResponse, 'product_images')
        ),
        catchError(this.handleError)
      );
  }
  // product.service.ts

  /**
   * Search the catalogue by code, or by words in a product's or its category's name.
   *
   * The endpoint is open, like the category pages the catalogue is otherwise read through, so a
   * visitor can search without an account.
   */
  searchProducts(term: string, lang: string = 'en', limit: number = 40): Observable<Product[]> {
    const url = `${this.apiUrl}/product/search?q=${encodeURIComponent(term)}&lang=${lang}&limit=${limit}`;
    return this.http.get<Product[]>(url).pipe(
      this.retryTransient(),
      map((products) =>
        (products || []).map((product) => this.withDeliveredImage(product, 'product_images'))
      ),
      catchError(this.handleError)
    );
  }

  // Helper method to get authorization headers
  private getAuthHeaders(): HttpHeaders {
    const token = getToken();
    if (!token) {
      return new HttpHeaders();
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  /**
   * What went wrong, in a shape a caller can use.
   *
   * The status goes with the message. Throwing a bare string threw the status away, and the panel
   * decides between "you are not allowed" and "something failed" by reading it - so a member of
   * staff who is not an administrator was told the panel had broken, and never that they had no
   * business being there. The toString keeps this readable if any caller shows the value directly.
   */
  private handleError(error: HttpErrorResponse) {
    if (typeof window !== 'undefined' && error.error instanceof ErrorEvent) {
      console.error('A client-side error occurred:', error.error.message);
    } else {
      console.error(`Backend returned code ${error.status}, body was: ${error.message}`);
    }
    console.error('Full error details:', error);
    const message = explainApiError(error) || 'Something went wrong; please try again later.';
    return throwError(() => ({
      status: (error && error.status) || 0,
      message,
      toString: () => message,
    }));
  }

  /**
   * One product, as the API stores it.
   *
   * The admin panel's worklists link to a product's editor, and a row there carries a code and a
   * category rather than the whole product the dialog needs. The API asks for a token here, unlike
   * the category pages, so the headers go with it.
   */
  getProductById(id: number, lang: string = 'al'): Observable<Product> {
    const url = `${this.apiUrl}/product/${id}?lang=${lang}`;
    return this.http.get<Product>(url, { headers: this.getAuthHeaders() }).pipe(
      this.retryTransient(),
      map((product) => this.withDeliveredImage(product, 'product_images')),
      catchError(this.handleError)
    );
  }

  updateProduct(product: Product): Observable<Product> {
    const headers = this.getAuthHeaders(); // Get authorization headers
  
    // Sanitize the product object
    const sanitizedProduct = this.sanitizePayload(product);
  
    return this.http.put<Product>(
      `${this.apiUrl}/product/${product.id}`,
      sanitizedProduct,
      { headers }
    );
  }
  
  // Helper function to sanitize the payload
  private sanitizePayload(product: any): any {
    // `id` travels in the URL, and slug/description/content are derived from the
    // active translation for display: sending them back made the API reject the
    // whole update with "Unknown field." (the real values live in translations).
    const { id, slug, description, content, ...cleanedProduct } = product;

    const payload: any = {
      ...cleanedProduct,
      dimensions: (product.dimensions || []).map((dimension: any) => {
        const { price_history, ...cleanedDimension } = dimension;
        return { ...cleanedDimension };
      }),
    };

    // Only send the image when there is one: destructuring an absent image threw
    // before the request was made, so saving such a product did nothing at all.
    if (product.image_asset) {
      const { id: imageId, ...cleanedImageAsset } = product.image_asset;
      payload.image_asset = cleanedImageAsset;
    }

    return payload;
  } 
  updateCategory(category: Category): Observable<Category> {
    const headers = this.getAuthHeaders();
    const sanitizedCategory = this.sanitizeCategoryPayload(category);
  
    return this.http.put<Category>(
      `${this.apiUrl}/category/without-products/${category.id}`,
      sanitizedCategory,
      { headers }
    );
  }
  // Helper function to sanitize category payload
private sanitizeCategoryPayload(category: Category): any {
  const { id, ...cleanedCategory } = category; // Remove the top-level id
  return {
    ...cleanedCategory,

  };
}

}
