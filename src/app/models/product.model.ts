    export interface ImageAsset {
      id: number;
      file_name: string;
      alternative_text: string;
      thumbnail_path: string;
      original_path: string;
    }
    
    export interface ProductDimension {
      id?: number;
      height?: number;
      width?: number;
      length?: number;
      weight?: number;
      price?: number;
      currency?: string;
      price_history?: any[]; // Adjust the type as needed
    }
      
    
    export interface ProductTranslation {
      id: number;
      language: string;
      content: string;
      slug: string;
      description: string;
    }
    
    export interface Product {
      id: number;
      code: string;
      cut_type: number;
      is_active: boolean;
      top_product: boolean;
      new_product: boolean;
      content?: string;
      slug?: string;
      description?: string;
      image_asset: ImageAsset;
      dimensions: ProductDimension[];
      translations: ProductTranslation[];
    }
    
    export interface Category {
      id: number;
      title: string;
      is_active: boolean;
      image_asset: ImageAsset;
      products?: Product[];
      description: string;
    }
    
  // models/pagination.model.ts

export interface Pagination {
  page: number;
  per_page: number;
  total_pages: number;
  total_items: number;
}
export interface Category {
  id: number;
  title: string;
  is_active: boolean;
  image_asset: ImageAsset;
  products?: Product[];
  pagination?: Pagination; // Add this line
  description: string; // If you have a description field
}
export interface CategoryResponse {
  products: Product[];
  pagination: Pagination;
}
