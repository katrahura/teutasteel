import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { adminGuard } from './guards/admin.guard';
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
    path: 'request',
    loadComponent: () => import('./pages/contact/contact.component').then(m => m.ContactComponent),
    data: { animation: 'ContactPage', requestPage: true },
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./pages/contact/contact.component').then((m) => m.ContactComponent),
    data: { animation: 'ContactPage' },
  },
  {
    path: 'services/:id',
    loadComponent: () => import('./pages/services/service-detail.component').then(m => m.ServiceDetailComponent),
    data: { animation: 'ServicePage' },
  },
  {
    path: 'services',
    loadComponent: () =>
      import('./pages/services/services.component').then((m) => m.ServicesComponent),
    data: { animation: 'AboutPage' },
  },
  {
    path: 'guides',
    loadComponent: () =>
      import('./pages/guides/guides.component').then((m) => m.GuidesComponent),
    data: { animation: 'AboutPage' },
  },
  {
    // Deliberately not in the sitemap and not in the page metadata: while the entries are samples,
    // a search engine should not be led here. See shared/projects.ts.
    path: 'projects',
    loadComponent: () =>
      import('./pages/projects/projects.component').then((m) => m.ProjectsComponent),
    data: { animation: 'AboutPage' },
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./pages/about/about.component').then((m) => m.AboutComponent),
    data: { animation: 'AboutPage' },
  },
  {
    // One place for the owner's work, with tabs. Përmbledhja is the dashboard as it was, moved here
    // unchanged; Produktet is the catalogue table. The rest of the tabs are named in the shell and
    // marked as coming rather than left as links that lead nowhere.
    path: 'admin/forbidden',
    loadComponent: () =>
      import('./pages/admin/admin-forbidden.component').then((m) => m.AdminForbiddenComponent),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./pages/admin/admin-shell.component').then((m) => m.AdminShellComponent),
    canActivate: [AuthGuard, adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./pages/admin-dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent
          ),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./pages/admin/products/admin-products.component').then(
            (m) => m.AdminProductsComponent
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/admin/settings/admin-settings.component').then(
            (m) => m.AdminSettingsComponent
          ),
      },
      {
        path: 'content',
        loadComponent: () =>
          import('./pages/admin/content/admin-content.component').then(
            (m) => m.AdminContentComponent
          ),
      },
      {
        path: 'media',
        loadComponent: () =>
          import('./pages/admin/media/admin-media.component').then((m) => m.AdminMediaComponent),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./pages/admin/categories/admin-categories.component').then(
            (m) => m.AdminCategoriesComponent
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/admin/users/admin-users.component').then((m) => m.AdminUsersComponent),
      },
    ],
  },
  {
    // The address everything already links to. Kept as a redirect so no existing link breaks.
    path: 'admin-dashboard',
    redirectTo: 'admin/overview',
    pathMatch: 'full',
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
