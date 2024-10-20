import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import bootstrap from 'bootstrap';  // Import Bootstrap's Modal class
import { TranslateModule } from '@ngx-translate/core';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule,RouterModule,TranslateModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [  // when element enters
        style({ opacity: 0 }),  // start with opacity 0
        animate('0.3s ease-in', style({ opacity: 1 }))  // fade to opacity 1
      ]),
      transition(':leave', [  // when element leaves
        animate('0.2s ease-out', style({ opacity: 0 }))  // fade to opacity 0
      ])
    ])
  ]
})
export class ProductsComponent {
  // Flag to track whether we're showing groups or products
  showingGroups = true;

  // Selected group for displaying products
  selectedGroup: ProductGroup | null = null;

  // Define the product groups
  productGroups: ProductGroup[] = [
    {
      id: 1,
      name: 'Steel Pipes',
      description: 'Durable galvanized steel pipes for industrial use.',
      image: 'https://picsum.photos/300/200',
    },
    {
      id: 2,
      name: 'Steel Sheets',
      description: 'High-quality steel sheets for various construction needs.',
      image: 'https://picsum.photos/300/200',
    },
    // Add more groups as needed
  ];

  // Define the products for each group
  productsByGroup: { [key: number]: Product[] } = {
    1: [
      {
        name: 'Galvanized Steel Pipe 1',
        image: 'https://picsum.photos/300/200',
        height: 3000,
        length: 100,
        width: 50,
        weight:90,
        whatsappNumber: '+1234567890',
      },
      {
        name: 'Galvanized Steel Pipe 2',
        image: 'https://picsum.photos/300/200',
        height: 2500,
        length: 120,
        width: 60,
        weight:90,
        whatsappNumber: '+1234567890',
      },
    ],
    2: [
      {
        name: 'Galvanized Steel Sheet 1',
        image: 'https://picsum.photos/300/200',
        height: 2000,
        length: 150,
        width: 70,
        weight:90,
        whatsappNumber: '+1234567890',
      },
      {
        name: 'Galvanized Steel Sheet 2',
        image: 'https://picsum.photos/300/200',
        height: 1800,
        length: 130,
        width: 80,
        weight:90,
        whatsappNumber: '+1234567890',
      },
    ],
  };

  // Function to show the products in a specific group
  showProducts(group: ProductGroup) {
    this.selectedGroup = group;
    this.showingGroups = false;
  }

  // Function to go back to showing groups
  goBackToGroups() {
    this.showingGroups = true;
    this.selectedGroup = null;
  }

  // Function to generate WhatsApp link
  getWhatsAppLink(product: Product): string {
    const message = `Hi, I'm interested in your product: ${product.name} (Height: ${product.height}mm, Length: ${product.length}mm, Width: ${product.width}mm). Could you provide more details?`;
    return `https://wa.me/${product.whatsappNumber}?text=${encodeURIComponent(message)}`;
  } 
   
}// Define the structure for a product
interface Product {
weight: any;
  name: string;
  image: string;
  height: number;
  length: number;
  width: number;
  whatsappNumber: string;
  icon?: string;
}

// Define the structure for a product group
interface ProductGroup {
  id: number;
  name: string;
  description: string;
  image: string;
  
}

