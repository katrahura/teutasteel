    export interface ImageAsset {
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
      /** Wall, sheet or web thickness in millimetres. */
      thickness?: number | string | null;
      weight?: number;
      /** The API sends decimals as strings ("3.80"), so these are not plain numbers. */
      price?: number | string;
      currency?: string;
      /** What the price is for: piece, tube, sheet, bar, metre, kilogram; null/undefined is unknown. */
      price_unit?: string | null;
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
      price_unit?: string;
      is_active: boolean;
      new_product:boolean;
      category_id?: number; // Added categoryId field
      /** The record version the server last reported; a save carries it so a stale form is refused. */
      version?: number | null;
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

/** What a category holds, so the filters can offer sizes that exist rather than invented ones. */
export interface CategoryFacets {
  /** At most a few dozen: a category has up to eighteen distinct thicknesses. */
  thicknesses: number[];
  /** The range of sizes, rather than the list: one category holds up to sixty-two of them. */
  height_min: number | null;
  height_max: number | null;
  total_thicknesses: number;
  total_sizes: number;
}

export interface CategoryResponse {
  products: Product[];
  pagination: Pagination;
  facets?: CategoryFacets;
}
