import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { AuthGuard } from './guards/auth.guard';

/**
 * The home page is eager: it is the first thing a visitor sees, and making it a
 * separate chunk would add a round trip before anything painted.
 *
 * Everything else is lazy. Before this, all of it sat in one 508 kB main bundle
 * that every visitor downloaded - including the products page with its admin
 * dialogs and both dashboards, which a visitor never opens.
 */
export const appRoutes: Routes = [
  { path: '', component: HomeComponent, data: { animation: 'HomePage' } },
  {
    path: 'products',
    loadComponent: () =>
      import('./pages/products/products.component').then((m) => m.ProductsComponent),
    data: { animation: 'ProductsPage' },
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./pages/contact/contact.component').then((m) => m.ContactComponent),
    data: { animation: 'ContactPage' },
  },
  {
    path: 'services',
    loadComponent: () =>
      import('./pages/services/services.component').then((m) => m.ServicesComponent),
    data: { animation: 'AboutPage' },
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./pages/about/about.component').then((m) => m.AboutComponent),
    data: { animation: 'AboutPage' },
  },
  {
    path: 'admin-dashboard',
    loadComponent: () =>
      import('./pages/admin-dashboard/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent
      ),
    canActivate: [AuthGuard],
    data: { animation: 'AboutPage' },
  },
  {
    path: 'user-dashboard',
    loadComponent: () =>
      import('./pages/user-dashboard/user-dashboard.component').then(
        (m) => m.UserDashboardComponent
      ),
    canActivate: [AuthGuard],
    data: { animation: 'AboutPage' },
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
    data: { animation: 'LoginPage' },
  },

  { path: '**', redirectTo: '', pathMatch: 'full' }  // Catch-all fallback
];
