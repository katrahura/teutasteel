import {  Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { Subscription } from 'rxjs';

import { ProductService } from '../../services/product.service';
import {
  Category,
  CategoryResponse,
  Product,
  ImageAsset
} from '../../models/product.model';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SharedService } from '../../shared.service';
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
  imports: [CommonModule, RouterModule, TranslateModule, FormsModule],
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
export class ProductsComponent implements OnInit, OnDestroy {

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
  isLoggedIn: boolean = false;
  newCategory: Category = {
    title: '',
    is_active: true,
    top_category: true,
    image_asset: {
      file_name: '',
      alternative_text: '',
      thumbnail_path: '',
      original_path: ''
    },
    }

    newProduct: Product = {
      code: '',
      category_id: 0,
      new_product:false,
      dimensions: [
        {
          height: 0,
          width: 0,
          length: 0,
          weight: 0,
          price: 0,
          currency: 'EUR',
        },
      ],
      translations: [
        {
          language: 'en',
          slug: '',
          description: '',
          content: '', // IMPORTANT if your schema expects "content"
        },
      ],
      cut_type: 0,
      is_active: true,
      image_asset: {
        file_name: '',
        alternative_text: '',
        thumbnail_path: '',
        original_path: '',
      },
    };
    
  
  // Cut Type Names Mapping
  cutTypeNames: { [key: number]: string } = {
    1: 'Type A',
    2: 'Type B',
    3: 'Type C',
    // Add other mappings as needed
  };
  changeDetectorRef: any;
  selectedCategoryId: any;

  constructor(private sharedService: SharedService,private router: Router,private productService: ProductService,@Inject(PLATFORM_ID) private platformId: Object,private authService: AuthService,private route: ActivatedRoute) {}

  openModal(product: any, event: Event): void {
    event.stopPropagation(); // Stop event propagation
    this.selectedProduct = product;

    // Ensure Angular detects the change

    // Open the Bootstrap modal
    const modalElement = document.getElementById('productDetailsModal');
    const modalInstance = new bootstrap.Modal(modalElement as HTMLElement);
    modalInstance.show();
  }
  
  closeModal(): void {
    const modalElement = document.getElementById('productDetailsModal');
    if (modalElement) {
      const modalInstance = bootstrap.Modal.getInstance(modalElement);
      modalInstance?.hide();
    }
  
    // Remove inert from body
    document.body.removeAttribute('inert');
  
    this.selectedProduct = null; // Clear selected product context
  }
  
  
  
  getFileNameFromPath(path: string): string {
    return path ? path.split('/').pop() || '' : '';
  }
  get thumbnailPath(): string {
    return this.selectedProduct?.image_asset?.thumbnail_path
      ? this.selectedProduct.image_asset.thumbnail_path.split('/').pop() || ''
      : '';
  }
  
  set thumbnailPath(value: string) {
    if (this.selectedProduct?.image_asset) {
      this.selectedProduct.image_asset.thumbnail_path = value;
  
    }
  }
  
  get originalPath(): string {
    return this.selectedProduct?.image_asset?.original_path
      ? this.selectedProduct.image_asset.original_path.split('/').pop() || ''
      : '';
  }
  
  set originalPath(value: string) {
    if (this.selectedProduct?.image_asset) {
      this.selectedProduct.image_asset.original_path = value;
  
    }
  }
  navigateLeft(): void {
    this.navigateProduct(-1);
  }
  
  navigateRight(): void {
    this.navigateProduct(1);
  }
  isNumericAndNotZero(value: any): boolean {
    return typeof value === 'number' && !isNaN(value) && value !== 0;
  }
  
  addNewDimension(): void {
    if (this.selectedProduct?.dimensions) {
      this.selectedProduct.dimensions.push({
        height: null,
        width: null,
        length: null,
        weight: null,
        price: null,
        currency: "EUR"
      });
    } else {
      this.selectedProduct.dimensions = [
        {
          height: null,
          width: null,
          length: null,
          weight: null,
          price: null,
          currency: "EUR"
        }
      ];
    }
  }
  
  addNewTranslation(): void {
    if (this.selectedProduct?.translations) {
      this.selectedProduct.translations.push({
        id: 0,
        language: '',
        content: '',
        slug: '',
        description: ''
      });
    } else {
      this.selectedProduct.translations = [
        {
          id: 0,
          language: '',
          content: '',
          slug: '',
          description: ''
        }
      ];
    }
  }
  
  removeDimension(index: number): void {
    if (this.selectedProduct?.dimensions) {
      this.selectedProduct.dimensions.splice(index, 1);
    }
  }
  
  removeTranslation(index: number): void {
    if (this.selectedProduct?.translations) {
      this.selectedProduct.translations.splice(index, 1);
    }
  }
    
 
  
  
  ngOnInit(): void {
    this.loadCategories();
    this.isLoggedIn= this.authService.isAuthenticated();
// Get the navigation object
const navigation = this.router.getCurrentNavigation();

// Check if the navigation contains a state
 if (this.sharedService.getCategory()){
  this.selectedCategory = this.sharedService.getCategory();
  this.showProducts(this.selectedCategory);
  this.sharedService.setCategory(null);
 }


}
addTranslation() {
  this.newProduct.translations!.push({
    language: '',
    slug: '',
    description: '',
    content: '' // Add the missing 'content' field
  });
}

NremoveTranslation(index: number) {
  this.newProduct.translations!.splice(index, 1);
}
createCategory() {
  this.productService.createCategory(this.newCategory).subscribe(
    (response) => {
      console.log('Category Created:', response);

    },
    (error) => console.error('Error creating category:', error)
  );
}
NewProdAddTranslation() {
  this.newProduct.translations!.push({
    language: '',
    slug: '',
    description: '',
    content: '' // If your schema expects 'content'
  });
}

addDimension() {
  this.newProduct.dimensions!.push({
    height: 0,
    width: 0,
    length: 0,
    weight: 0,
    price: 0,
    currency: 'EUR'
  });
}


createProduct() {
  if (!this.selectedCategory) {
    alert('Please select a category first.');
    return;
  }
  if (this.newProduct.dimensions.length === 0) {
    alert('Please add at least one dimension.');
    return;
  }
  if (this.newProduct.translations.length === 0) {
    alert('Please add at least one translation.');
    return;
  }
  
debugger;
  // Attach the categoryId
  this.newProduct.category_id = this.selectedCategory.id!;

  // POST the product
  this.productService.createProduct(this.newProduct).subscribe({
    next: (response) => {
        this.productService.getCategoryById(this.selectedCategory!.id!, this.currentPage)

      // Reset the form
      this.newProduct = {
        code: '',
        category_id: 0,
        new_product:false,
        dimensions: [
          {
            height: 0,
            width: 0,
            length: 0,
            weight: 0,
            price: 0,
            currency: 'EUR',
          },
        ],
        translations: [
          {
            language: 'en',
            slug: '',
            description: '',
            content: '',
          },
        ],
        cut_type: 0,
        is_active: true,
        image_asset: {
          file_name: '',
          alternative_text: '',
          thumbnail_path: '',
          original_path: '',
        },
      };
      





      
this.closeProductModals();
this.showProducts(this.selectedCategory)



    },
  });
  
}


 closeProductModals(): void {
    const modalElementa = document.getElementById('createProductModal');
    if (modalElementa) {
      const modal = bootstrap.Modal.getInstance(modalElementa);
      modal.hide();
      setTimeout(() => {
  document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('padding-right');
  document.body.style.removeProperty('overflow');
}, 200);

    }}


  openEditModal(product: Product): void {
    // Clone the product to avoid direct mutation
    this.selectedProduct = { ...product };
  
    // Update the paths when the modal is opened
    if (this.selectedProduct?.image_asset) {
      this.originalPath = this.originalPath;
      this.thumbnailPath = this.thumbnailPath;
    }
  
    // Open the Bootstrap modal
    const modalElement = document.getElementById('editProductModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }
  

  updateProduct(): void {
    if (this.selectedProduct) {
      this.productService.updateProduct(this.selectedProduct).subscribe(() => {
        alert('Product updated successfully!');
        this.productService.getCategoryById(this.selectedCategory!.id!, this.currentPage)
        this.showProducts(this.selectedCategory)
        this.closeEditModal();
      });
    }
  }

  closeEditModal(): void {
    const modalElement = document.getElementById('editProductModal');
    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      modal.hide();
    }
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
  showProducts(category: any) {
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
  loadCategoryWithProducts(category_id: number, page: number = 1) {
    this.isLoading=true;
    const sub = this.productService.getCategoryById(category_id, page).subscribe({
      next: (categoryResponse: CategoryResponse) => {
        this.products = this.selectedProduct = categoryResponse.products || [];
        this.currentPage = categoryResponse.pagination.page;
        this.totalPages = categoryResponse.pagination.total_pages;
        this.isLoading = false; // Turn off loader

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
        this.selectedCategory.id!,
        this.currentPage + 1
      );
    }
  }

  loadPreviousPage() {
    if (this.currentPage > 1 && this.selectedCategory) {
      this.loadCategoryWithProducts(
        this.selectedCategory.id!,
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
  editCategory(category: Category): void {
    this.selectedCategory = { ...category }; // Clone to avoid direct mutation
        // Update the paths when the modal is opened
        if (this.selectedCategory?.image_asset) {
          this.originalPathC = this.getFileNameFromPath(this.selectedCategory.image_asset.original_path);
          this.thumbnailPathC = this.getFileNameFromPath(this.selectedCategory.image_asset.thumbnail_path);
        }
        console.log(this.originalPath)
    const modalElement = document.getElementById('editCategoryModal');
    if (modalElement) {
      const modalInstance = new bootstrap.Modal(modalElement);
      modalInstance.show();
    }
  }
  
  updateCategory(): void {
    if (this.selectedCategory) {
      this.productService.updateCategory(this.selectedCategory).subscribe({
        next: () => {
          alert('Category updated successfully!');
          this.loadCategories(); // Refresh categories after update
          this.closeEditCategoryModal();
        },
        error: (err) => {
          console.error('Error updating category:', err);
          alert('Failed to update category. Please try again.');
        },
      });
    }
  }
  
  closeEditCategoryModal(): void {
    const modalElement = document.getElementById('editCategoryModal');

    if (modalElement) {
      const modalInstance = bootstrap.Modal.getInstance(modalElement);
      modalInstance?.hide();
    }
    this.selectedCategory = null; // Clear the selected category
  }
  get categoryTitle(): string {
    return this.selectedCategory?.title || '';
  }
  
  set categoryTitle(value: string) {
    if (this.selectedCategory) {
      this.selectedCategory.title = value;
    }
  }
  
  get isActive(): boolean {
    return !!this.selectedCategory?.is_active;
  }
  
  set isActive(value: boolean) {
    if (this.selectedCategory) {
      this.selectedCategory.is_active = value;
    }
  }
  
  get topCategory(): boolean {
    return !!this.selectedCategory?.top_category;
  }
  
  set topCategory(value: boolean) {
    if (this.selectedCategory) {
      this.selectedCategory.top_category = value;
    }
  }
  
  get fileName(): string {
    return this.selectedCategory?.image_asset?.file_name || '';
  }
  
  set fileName(value: string) {
    if (this.selectedCategory?.image_asset) {
      this.selectedCategory.image_asset.file_name = value;
    }
  }
  
  get alternativeText(): string {
    return this.selectedCategory?.image_asset?.alternative_text || '';
  }
  
  set alternativeText(value: string) {
    if (this.selectedCategory?.image_asset) {
      this.selectedCategory.image_asset.alternative_text = value;
    }
  }
  get thumbnailPathC(): string {
    return this.selectedCategory?.image_asset?.thumbnail_path
    ? this.selectedCategory.image_asset.thumbnail_path.split('/').pop() || ''
    : '';
  }
  
  set thumbnailPathC(value: string) {
    if (this.selectedCategory?.image_asset) {
      this.selectedCategory.image_asset.thumbnail_path = value;
    }
  }
  
  get originalPathC(): string {
    return this.selectedCategory?.image_asset?.original_path
    ? this.selectedCategory.image_asset.original_path.split('/').pop() || ''
    : '';
    
  }
  
  set originalPathC(value: string) {
    if (this.selectedCategory?.image_asset) {
      this.selectedCategory.image_asset.original_path = value;
    }
  }
  
}
