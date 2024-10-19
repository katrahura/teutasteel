import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule,NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule,CommonModule],  // Import RouterModule to enable routerLink
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  currentRoute: string = '';

  constructor(private router: Router) {
    // Detect route changes and update the currentRoute variable
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentRoute = event.urlAfterRedirects;
    });
  }
  title = 'teutasteel-website';
  getGradientClass(): string {
    if (this.currentRoute === '/products') {
      return 'products-gradient';
    } else if (this.currentRoute === '/about') {
      return 'about-gradient';
    } else if (this.currentRoute === '/contact') {
      return 'contact-gradient';
    } else {
      return 'default-gradient'; // Fallback for the home or other pages
    }
  }
  
}
