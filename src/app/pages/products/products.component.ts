import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { Subscription } from 'rxjs';

import { ProductService } from '../../services/product.service';
import {
  Category,
  CategoryResponse,
  Product,
  ProductDimension,
} from '../../models/product.model';
type DimensionKey =
  | 'height'
  | 'width'
  | 'length'
  | 'weight'
  | 'price'
  | 'currency';
  declare var bootstrap: any;

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0.3s ease-in', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('0.2s ease-out', style({ opacity: 0 }))]),
    ]),
  ],
})
export class ProductsComponent implements OnInit, OnDestroy,AfterViewInit {
  @ViewChild('productDetailsModal') productDetailsModal!: ElementRef;

  subscriptions: Subscription[] = [];
  showingGroups = true;
  dimensionKeys: DimensionKey[] = [
    'height',
    'width',
    'length',
    'weight',
    'price',
    'currency',
  ];
  selectedProductIndex: number = 0;
  imageWidthPercent = 80;
  categories: Category[] = [];
  selectedCategory: Category | null = null;
  products: Product[] = [];
  productsCopy: any[] = [];
  selectedProduct: any = null;
  currentPage = 1;
  totalPages = 1;
  perPage = 10;
  isLoading = true; // Default to loading

  // Cut Type Names Mapping
  cutTypeNames: { [key: number]: string } = {
    1: 'Type A',
    2: 'Type B',
    3: 'Type C',
    // Add other mappings as needed
  };

  constructor(private productService: ProductService,@Inject(PLATFORM_ID) private platformId: Object) {}
  ngAfterViewInit(): void {
    throw new Error('Method not implemented.');
  }
  openModal(product: Product): void {
    this.selectedProduct = product;
  
    const modalElement = this.productDetailsModal?.nativeElement;
    if (!modalElement) {
      console.error('Modal element not found!');
      return;
    }
  
    let modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (!modalInstance) {
      modalInstance = new bootstrap.Modal(modalElement);
    }
    modalInstance.show();
  }
  
  

  closeModal(): void {
    const modalElement = this.productDetailsModal?.nativeElement;
    if (modalElement) {
      const modalInstance = bootstrap.Modal.getInstance(modalElement);
      modalInstance?.hide();
    }
    this.selectedProduct = null; // Clear selected product context
  }
  
  
  ngOnInit(): void {
    this.loadCategories();
  }

  // Load categories from the API
  loadCategories() {
    this.isLoading=true;
    const sub = this.productService.getCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.isLoading = false; // Turn off loader

      },
      error: (error) => {
        console.error('Error occurred while fetching categories:', error);
      },
    });
    this.subscriptions.push(sub);
  }

  

  // Show products for a specific category
  showProducts(category: Category) {
    this.selectedCategory = category;
    this.showingGroups = false;

    if (category.products && category.products.length > 0) {
      // Products are already included in the category data
      this.products = category.products;
    } else {
      // Fetch the category data including products
      this.loadCategoryWithProducts(category.id, 1);
    }
  }

  // Go back to showing categories
  goBackToGroups() {
    this.showingGroups = true;
    this.selectedCategory = null;
    this.products = [];
  }

  // Generate WhatsApp link
  getWhatsAppLink(product: Product): string {
    const message = `Hi, I'm interested in your product: ${product?.code}. Could you provide more details?`;
    const whatsappNumber = '+1234567890'; // Replace with your actual number or include it in the product data
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
      message
    )}`;
  }

  // Helper method to get a dimension value
  getProductDimension(
    product: Product,
    dimensionKey: DimensionKey
  ): number | string {
    if (product.dimensions && product.dimensions.length > 0) {
      const dimensionValue = product.dimensions[0][dimensionKey];
      return dimensionValue !== undefined && dimensionValue !== null
        ? dimensionValue
        : 'N/A';
    }
    return 'N/A';
  }

  // Helper method to get cut type name
  getCutTypeName(cutType: number): string {
    return this.cutTypeNames[cutType] || 'Unknown';
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }
  loadCategoryWithProducts(categoryId: number, page: number = 1) {
    this.isLoading=true;
    const sub = this.productService.getCategoryById(categoryId, page).subscribe({
      next: (categoryResponse: CategoryResponse) => {
        this.products = categoryResponse.products || [];
        this.currentPage = categoryResponse.pagination.page;
        this.totalPages = categoryResponse.pagination.total_pages;
        this.isLoading = false; // Turn off loader

        // this.selectedCategory = categoryResponse; // Now includes pagination
      },
      error: (error) => {
        console.error('Error occurred while fetching category:', error);
      },
    });
    this.subscriptions.push(sub);
  }

  loadNextPage() {
    if (this.currentPage < this.totalPages && this.selectedCategory) {
      this.loadCategoryWithProducts(
        this.selectedCategory.id,
        this.currentPage + 1
      );
    }
  }

  loadPreviousPage() {
    if (this.currentPage > 1 && this.selectedCategory) {
      this.loadCategoryWithProducts(
        this.selectedCategory.id,
        this.currentPage - 1
      );
    }
  }
  navigateProduct(direction: number): void {
    const currentIndex = this.products.findIndex(
      (p) => p.id === this.selectedProduct?.id
    );
  
    if (currentIndex === -1) {
      console.error('Selected product not found in the product list.');
      return;
    }
  
    const newIndex = (currentIndex + direction + this.products.length) % this.products.length;
    this.selectedProduct = this.products[newIndex];
  }
  
}
