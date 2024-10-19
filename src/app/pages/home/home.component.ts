import { CommonModule } from '@angular/common';
import { Component, ElementRef, Renderer2, Inject, PLATFORM_ID  } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { isPlatformBrowser } from '@angular/common';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule,CommonModule,TranslateModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  constructor(@Inject(PLATFORM_ID) private platformId: Object, private el: ElementRef, private renderer: Renderer2) {}

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
  products = [
    {
      name: 'Galvanized Steel Pipe 1',
      description: 'High-quality galvanized steel pipe, perfect for industrial and commercial applications.',
      image: 'https://picsum.photos/300/200',  // Placeholder image
      height: 3000,
      length: 100,
      width: 50
    },
    {
      name: 'Galvanized Steel Pipe 2',
      description: 'Durable steel pipe designed for heavy-duty use in construction projects.',
      image: 'https://picsum.photos/300/200',  // Placeholder image
      height: 2500,
      length: 120,
      width: 60
    },
    {
      name: 'Steel Sheet 1',
      description: 'High-grade steel sheets, ideal for various construction and industrial purposes.',
      image: 'https://picsum.photos/300/200',  // Placeholder image
      height: 2000,
      length: 150,
      width: 70
    },
    {
      name: 'Steel Beam 1',
      description: 'Strong and durable steel beams for supporting large structures.',
      image: 'https://picsum.photos/300/200',  // Placeholder image
      height: 1800,
      length: 130,
      width: 80
    },
    {
      name: 'Metal Fencing Panel',
      description: 'Galvanized steel fencing panels for secure perimeter protection.',
      image: 'https://picsum.photos/300/200',  // Placeholder image
      height: 2500,
      length: 200,
      width: 20
    },
    {
      name: 'Steel Wire',
      description: 'High-tensile steel wire for industrial and construction applications.',
      image: 'https://picsum.photos/300/200',  // Placeholder image
      height: 1500,
      length: 100,
      width: 10
    }
  ];
  featuredProducts = [
    {
      name: 'Galvanized Steel Pipe 1',
      description: 'High-quality galvanized steel pipe, perfect for industrial and commercial applications.',
      image: 'https://picsum.photos/300/200',
      whatsappNumber: '1234567890', // Replace with actual WhatsApp number
      isNew:true
    },
    {
      name: 'Galvanized Steel Pipe 2',
      description: 'Durable steel pipe designed for heavy-duty use in construction projects.',
      image: 'https://picsum.photos/300/200',
      whatsappNumber: '1234567890',
      isNew:true

    },
    {
      name: 'Steel Sheet 1',
      description: 'High-grade steel sheets, ideal for various construction and industrial purposes.',
      image: 'https://picsum.photos/300/200',
      whatsappNumber: '1234567890',
      isNew:true

    }
  ];
  contactViaWhatsApp(product: { name: any; whatsappNumber: any; }) {
    const message = encodeURIComponent(`Hello, I am interested in your product: ${product.name}`);
    const whatsappUrl = `https://wa.me/${product.whatsappNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  }
}
