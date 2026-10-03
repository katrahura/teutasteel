import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service'; // ✅ Make sure this path is correct
import { TranslateModule } from '@ngx-translate/core';

@Component({
  standalone: true,
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  imports: [CommonModule, ReactiveFormsModule,TranslateModule]
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isLoggedIn = false;
  errorMessage: string | null = null;
  username = '';
  role = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isAuthenticated();
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

        // Optional: You could parse the token or response to determine the role
        // debugger;
        // this.role = response.role || 'user'; // fallback role
        // if (this.role === 'admin') {
        //   this.router.navigate(['/admin-dashboard']);
        // } else {
        //   this.router.navigate(['/user-dashboard']);
        // }

        this.errorMessage = null;
      },
      error: (err) => {
        console.error('Login failed', err);
        this.errorMessage = 'Invalid username or password';
      }
    });
  }
goToAdmin(): void {
  this.router.navigate(['/admin-dashboard']);
}

goToUser(): void {
  this.router.navigate(['/user-dashboard']);
}

  onLogout(): void {
    this.isLoggedIn = false;
    this.role = '';
    this.username = '';
    this.loginForm.reset();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
