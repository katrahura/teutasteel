import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule,CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
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
