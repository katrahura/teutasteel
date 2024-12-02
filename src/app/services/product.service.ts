import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { catchError, Observable, throwError, map, retry } from 'rxjs';
import { Category, CategoryResponse, Product } from '../models/product.model';
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


  getCategoryById(categoryId: number, page: number = 1, perPage: number = 8): Observable<CategoryResponse> {
    const url = `${this.apiUrl}/category/${categoryId}?page=${page}&per_page=${perPage}`;
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
}
