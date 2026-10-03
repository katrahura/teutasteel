import { Directive, ElementRef, HostListener, Input, inject } from '@angular/core';

/**
 * Replaces an image that fails to load with the placeholder for its kind.
 *
 * The catalogue's image paths come from Cloudinary, and an asset that has been
 * deleted or renamed leaves a path in the database that is set but dead. That
 * renders as a broken image icon in the middle of the catalogue, even though the
 * templates already know which placeholder to use for a product or category with no
 * image at all — this covers the other half of the case.
 */
@Directive({
  selector: 'img[appImageFallback]',
  standalone: true,
})
export class ImageFallbackDirective {
  @Input('appImageFallback') fallback = 'assets/images/placeholder_product.jpg';

  private readonly image = inject(ElementRef<HTMLImageElement>);

  @HostListener('error')
  onError(): void {
    const element = this.image.nativeElement;
    const target = new URL(this.fallback, document.baseURI).href;
    // guard against looping when the placeholder itself is missing
    if (element.src !== target) {
      element.src = this.fallback;
    }
  }
}
