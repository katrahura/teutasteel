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
      /** Wall, sheet or web thickness in millimetres. */
      thickness?: number | string | null;
      weight?: number;
      /** The API sends decimals as strings ("3.80"), so these are not plain numbers. */
      price?: number | string;
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
      /** Legacy flag. The API returns it and keeps it in step with parent_id; the client
       *  never sends it, because the parent is what decides the grouping. */
      top_category?: boolean;
      /** Parent category, or null/absent for a top-level category. */
      parent_id?: number | null;
      image_asset?: ImageAsset;
      products?: Product[];
      pagination?: Pagination; // Add this line
    }
    export interface TopCategory {
      id?: number;
      title: string;
      is_active: boolean;
      top_category?: boolean;
      image_asset?: ImageAsset;
      /**
       * Products reachable in this group and everything under it, counted by the API and active
       * branches only. The home page's tiles state it; nothing stores it.
       */
      product_count?: number;
      children?: TopCategory[];
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
