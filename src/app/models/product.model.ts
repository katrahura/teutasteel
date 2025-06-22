import { BlobOptions } from "buffer";

    export interface ImageAsset {
      file_name: string;
      alternative_text: string;
      thumbnail_path: string;
      original_path: string;
    }

    export interface ProductDimension {
      height?: number;
      width?: number;
      length?: number;
      weight?: number;
      price?: number;
      currency?: string;
      price_history?: PriceHistory[]; // Adjust the type as needed
    }
    export interface PriceHistory {
      id?: number;
      price: number;
      currency: string;
      start_date: string;
      end_date?: string;
    }

    export interface ProductTranslation {
      language: string;
      content: string;
      slug: string;
      description: string;
    }
    
    export interface Product {
      id?: number;
      code: string;
      cut_type: number;
      is_active: boolean;
      new_product:boolean;
      category_id?: number; // Added categoryId field
      // content?: string;
      slug?: string;
      description?: string;
      image_asset?: ImageAsset;
      dimensions: ProductDimension[];
      translations: ProductTranslation[];
    }
    

    export interface Category {
      id?: number;
      title: string;
      is_active: boolean;
      top_category:boolean;
      image_asset?: ImageAsset;
      products?: Product[];
      pagination?: Pagination; // Add this line
    }
    export interface TopCategory {
      id?: number;
      title: string;
      is_active: boolean;
      top_category:boolean;
      image_asset?: ImageAsset;
    }
    
  // models/pagination.model.ts

export interface Pagination {
  page: number;
  per_page: number;
  total_pages: number;
  total_items: number;
}

export interface CategoryResponse {
  products: Product[];
  pagination: Pagination;
}
