import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { ProductsComponent } from './pages/products/products.component';
import { ContactComponent } from './pages/contact/contact.component';
import { AboutComponent } from './pages/about/about.component';

export const appRoutes: Routes = [
  { path: '', component: HomeComponent, data: { animation: 'HomePage' } },
  { path: 'products', component: ProductsComponent, data: { animation: 'ProductsPage' } },
  { path: 'contact', component: ContactComponent, data: { animation: 'ContactPage' } },
  { path: 'about', component: AboutComponent, data: { animation: 'AboutPage' } },
  { path: '**', redirectTo: '', pathMatch: 'full' }  // Catch-all fallback
];
