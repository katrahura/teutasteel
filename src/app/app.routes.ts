import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { ProductsComponent } from './pages/products/products.component';
import { ContactComponent } from './pages/contact/contact.component';
import { AboutComponent } from './pages/about/about.component';
import { LoginComponent } from './pages/login/login.component';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { UserDashboardComponent } from './pages/user-dashboard/user-dashboard.component';
import { AuthGuard } from './guards/auth.guard';

export const appRoutes: Routes = [
  { path: '', component: HomeComponent, data: { animation: 'HomePage' } },
  { path: 'products', component: ProductsComponent, data: { animation: 'ProductsPage' } },
  { path: 'contact', component: ContactComponent, data: { animation: 'ContactPage' } },

  { path: 'about', component: AboutComponent, data: { animation: 'AboutPage' } },
  { path: 'admin-dashboard', component: AdminDashboardComponent, canActivate: [AuthGuard], data: { animation: 'AboutPage' } },
  { path: 'user-dashboard', component: UserDashboardComponent, canActivate: [AuthGuard], data: { animation: 'AboutPage' } },
  { path: 'login', component: LoginComponent, data: { animation: 'LoginPage' } },
  
  { path: '**', redirectTo: '', pathMatch: 'full' }  // Catch-all fallback
];
