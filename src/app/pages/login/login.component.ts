import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  standalone: true,
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  imports: [CommonModule, ReactiveFormsModule, TranslateModule]
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isLoggedIn = false;
  /** Holds a translation key; the template pipes it. */
  errorMessage: string | null = null;
  username = '';
  role: string | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private users: UserService
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isAuthenticated();
    if (this.isLoggedIn) {
      // Already signed in (for example after a reload): find out which
      // dashboard belongs to this account.
      this.loadProfile(false);
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    const { username, password } = this.loginForm.value;

    this.authService.login({ username, password }).subscribe({
      next: (response) => {
        // Save the JWT through the shared, SSR-safe helper
        this.authService.storeToken(response.access_token);

        this.username = username;
        this.isLoggedIn = true;
        this.errorMessage = null;

        // The token only carries the user id, so the role comes from the API.
        this.loadProfile(true);
      },
      error: (err) => {
        console.error('Login failed', err);
        this.errorMessage = 'LOGIN.INVALID';
      }
    });
  }

  private loadProfile(navigate: boolean): void {
    const id = this.authService.currentUserId();
    if (id === null) {
      if (navigate) {
        this.router.navigate(['/user-dashboard']);
      }
      return;
    }

    this.users.getById(id).subscribe({
      next: (user) => {
        this.role = user?.role ?? null;
        this.username = user?.username ?? this.username;
        if (navigate) {
          this.goToDashboard();
        }
      },
      error: () => {
        if (navigate) {
          this.router.navigate(['/user-dashboard']);
        }
      },
    });
  }

  /** Sends the visitor to the dashboard that matches their role. */
  goToDashboard(): void {
    this.router.navigate([this.role === 'admin' ? '/admin-dashboard' : '/user-dashboard']);
  }

  onLogout(): void {
    this.isLoggedIn = false;
    this.role = null;
    this.username = '';
    this.loginForm.reset();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
