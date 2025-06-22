import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { catchError, Observable, throwError, map, retry } from 'rxjs';
import { Category, CategoryResponse, Product, TopCategory } from '../models/product.model';
@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private apiUrl = 'http://127.0.0.1:5000'; // Replace with your actual API base URL
  private cloudinaryBaseUrl = 'https://res.cloudinary.com/dy0idyurz/image/upload';


  constructor(private http: HttpClient) {}

  // Method to get all categories
  getCategories(): Observable<Category[]> {
    const url = `${this.apiUrl}/category/`;
    return this.http
      .get<Category[]>(url, { headers: this.getAuthHeaders() })
      .pipe(
        retry(4),
        map((categories) =>
          this.transformCategories(categories, 'category_images')
        ), // Transform the response
        catchError(this.handleError)
      );
  }
  getTopCategories(): Observable<TopCategory[]> {
    const url = `${this.apiUrl}/category/top_categories/`;
    return this.http
      .get<TopCategory[]>(url, { headers: this.getAuthHeaders() })
      .pipe(retry(4),
      map((categories) =>
        this.transformCategories(categories, 'category_images')
      ), // Transform the response
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
  private transformCategories(
    categories: Category[],
    folder: string
  ): Category[] {
    return categories.map((category) => {
      if (category.image_asset) {
        category.image_asset.original_path = `${this.cloudinaryBaseUrl}/${folder}/${category.image_asset.original_path}`;
        category.image_asset.thumbnail_path = `${this.cloudinaryBaseUrl}/${folder}/${category.image_asset.thumbnail_path}`;
      }
      return category;
    });
  }
  private transformProducts(category: CategoryResponse, folder: string): CategoryResponse {
    if (category.products) {
      category.products.forEach((product) => {
        if (product.image_asset) {
          product.image_asset.original_path = `${this.cloudinaryBaseUrl}/${folder}/${product.image_asset.original_path}`;
          product.image_asset.thumbnail_path = `${this.cloudinaryBaseUrl}/${folder}/${product.image_asset.thumbnail_path}`;
        }
      });
    }
    return category;
  }
  // Method to get a single category by ID, including its products


  getCategoryById(category_id: number, page: number = 1, perPage: number = 8): Observable<CategoryResponse> {
    const url = `${this.apiUrl}/category/${category_id}?page=${page}&per_page=${perPage}`;
    return this.http.get<CategoryResponse>(url, { headers: this.getAuthHeaders() })
      .pipe(
        retry(4),
        map((CategoryResponse) =>
          this.transformProducts(CategoryResponse, 'product_images')
        ),
        catchError(this.handleError)
      );
  }
  // product.service.ts

  // Helper method to get authorization headers
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token'); // Retrieve token from localStorage
    return new HttpHeaders({
      Authorization: `Bearer ${token}`, // Add Authorization header
    });
  }

  private handleError(error: HttpErrorResponse) {
    if (typeof window !== 'undefined' && error.error instanceof ErrorEvent) {
      // Client-side error
      console.error('A client-side error occurred:', error.error.message);
    } else {
      // Server-side error
      console.error(
        `Backend returned code ${error.status}, body was: ${error.message}`
      );
    }
    console.error('Full error details:', error);
    return throwError('Something went wrong; please try again later.');
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
    const { id, ...cleanedProduct } = product; // Remove the top-level id
    return {
      ...cleanedProduct,
      dimensions: product.dimensions.map((dimension: any) => {
        const { price_history, ...cleanedDimension } = dimension;
        return {
          ...cleanedDimension,
          
        };
      }),
    
      image_asset: (() => {
        const { id, ...cleanedImageAsset } = product.image_asset;
        return cleanedImageAsset;
      })()
    };
    
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