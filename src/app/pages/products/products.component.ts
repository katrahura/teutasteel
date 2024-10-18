import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css'
})
export class ProductsComponent {
  products = [
    { name: '30x30x2 mm', description: 'High-quality galvanized steel pipe' },
    { name: '60x40x1.5 mm', description: 'Durable and corrosion-resistant steel pipe' },
    // Add more products here
  ];
}

