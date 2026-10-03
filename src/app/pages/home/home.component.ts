import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { ProductService } from '../../services/product.service';
import { TopCategory } from '../../models/product.model';
import { SharedService } from '../../shared.service';
import { translateCategoryTitle } from '../../shared/translate-category-title';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CommonModule, TranslateModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnDestroy {
  private subscriptions = new Subscription();
  topCategories: TopCategory[] = [];

  constructor(
    private sharedService: SharedService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private productService: ProductService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    // Only the browser fetches data: prerendering/SSR must not call the API.
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const sub = this.productService.getTopCategories().subscribe({
      next: (data) => {
        this.topCategories = data;
      },
      error: (error) => {
        console.error('Error occurred while fetching categories:', error);
      },
    });
    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  navigateToProducts(category: any): void {
    this.sharedService.setCategory(category); // Save the object
    this.router.navigate(['/products']); // Navigate to products page
  }

  /** Category names are stored in one language; translate them for display. */
  categoryTitle(category: any): string {
    return translateCategoryTitle(this.translate, category);
  }
}
