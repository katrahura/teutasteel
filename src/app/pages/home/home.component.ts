import { CommonModule } from '@angular/common';
import { Component, ElementRef, Renderer2, Inject, PLATFORM_ID  } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { isPlatformBrowser } from '@angular/common';
import { ProductService } from '../../services/product.service';
import { Product, TopCategory } from '../../models/product.model';
import { AuthService } from '../../services/auth.service';
import { SharedService } from '../../shared.service';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule,CommonModule,TranslateModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})  
export class HomeComponent {
  subscriptions: any;
  constructor(private sharedService: SharedService,private router: Router,@Inject(PLATFORM_ID) private platformId: Object, private el: ElementRef, private renderer: Renderer2,private productService: ProductService,private authService: AuthService) {}
  selectedCategory: any = null;
  topCategories: TopCategory[] = [];
 
  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const sectionElement = this.el.nativeElement.querySelector('#backgroundImage');
  
      if (sectionElement) {
        // Get the background image URL from the inline style
        const bgImage = sectionElement.style.backgroundImage;
        const imageUrl = bgImage.slice(5, -2); // Extract the image URL from background-image property
  
        // Load the image using the JavaScript Image object
        const img = new Image();
        img.crossOrigin = "anonymous";  // Handle cross-origin issues if needed
        img.src = imageUrl;
  
        img.onload = () => {
          this.adjustTextColorBasedOnImage(img);
        };
      } else {
        console.error("Section element not found.");
      }
    }
  }
  ngOnInit():void{
    this.productService.getTopCategories()
    const sub = this.productService.getTopCategories().subscribe({
      next: (data) => {
        this.topCategories = data;
        // this.isLoading = false; // Turn off loader

      },
      error: (error) => {
        console.error('Error occurred while fetching categories:', error);
      },
    });
    this.subscriptions.push(sub);

  }
  navigateToProducts(category: any): void {
   
    this.sharedService.setCategory(category); // Save the object
    this.router.navigate(['/products']); // Navigate to products page
  }
  
  
  
  adjustTextColorBasedOnImage(image: HTMLImageElement): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
  
    if (context) {
      // Set canvas dimensions to match image dimensions
      canvas.width = image.width;
      canvas.height = image.height;
  
      // Draw the image onto the canvas
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
  
      // Get the pixel data
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const rgb = this.getAverageColor(imageData);
  
      // Calculate appropriate text color (black or white) based on background brightness`
      const textColor = this.getTextColorForBackground(rgb);
      console.log(textColor);
      // Apply the text color to the content
      const dynamicDiv = this.el.nativeElement.querySelector('#dynamictxtcolor');
      if (dynamicDiv) {
        const childElements = dynamicDiv.querySelectorAll('h1, p'); // Select h1, p, a elements
        childElements.forEach((element: HTMLElement) => {
          this.renderer.setStyle(element, 'color', textColor); // Apply color to each child element
          this.renderer.setStyle(element, 'text-shadow', `0.03em 0.03em 0.03em ${textColor === 'white' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.4)'}`);

        });
      }
      
    }      
  }
  

  // Calculate average color from image data
  private getAverageColor(imageData: ImageData): {r: number, g: number, b: number} {
    const pixels = imageData.data;
    let r = 0, g = 0, b = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      r += pixels[i];     // Red
      g += pixels[i + 1]; // Green
      b += pixels[i + 2]; // Blue
    }

    const pixelCount = pixels.length / 4;
    return { r: Math.round(r / pixelCount), g: Math.round(g / pixelCount), b: Math.round(b / pixelCount) };
  }

  // Determine whether to use white or black text based on the average color's luminance
  private getTextColorForBackground(rgb: {r: number, g: number, b: number}): string {
    const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
    return luminance > 150 ? 'black' : 'white';
  }
  openProductModal(product: any) {
    this.selectedCategory = product;
  }

  featuredProducts = [
    {
      name: 'Galvanized Steel Pipe 1',
      description: 'High-quality galvanized steel pipe, perfect for industrial and commercial applications.',
      image: 'https://picsum.photos/300/200',
      isNew:true
    },
    {
      name: 'Galvanized Steel Pipe 2',
      description: 'Durable steel pipe designed for heavy-duty use in construction projects.',
      image: 'https://picsum.photos/300/200',
      isNew:true

    },
    {
      name: 'Steel Sheet 1',
      description: 'High-grade steel sheets, ideal for various construction and industrial purposes.',
      image: 'https://picsum.photos/300/200',
      isNew:true

    }
  ];
  contactViaWhatsApp(product: Product) {
    if (product && product.code) {
    const message = encodeURIComponent(`Hello, I am interested in your product: ${product.code}`);
    const whatsappUrl = `https://wa.me/1234567890?text=${message}`;
    window.open(whatsappUrl, '_blank');
  }
  
  }
}
