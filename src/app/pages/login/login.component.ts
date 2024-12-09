import { Component ,OnInit} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  imports: [FormsModule,CommonModule],
  standalone: true,

})
export class LoginComponent {
  username: string = '';
  password: string = '';
  errorMessage: string | null = null;
  isLoggedIn: boolean = false; // State to track login status


  constructor(private authService: AuthService, private router: Router) {}
  ngOnInit():void{
this.isLoggedIn= this.authService.isAuthenticated();

  }
  onSubmit() {
    
    this.authService.login({ username: this.username, password: this.password }).subscribe({
      next: (response) => {
        localStorage.setItem('token', response.access_token); // Save token to local storage
        this.router.navigate(['/']); // Redirect to the home page
        this.isLoggedIn=true;
      },
      error: (error) => {
        console.error('Login failed', error);
      },
    });
  }
  onLogout() {
    this.isLoggedIn=false;
    this.authService.logout();
  }
}
