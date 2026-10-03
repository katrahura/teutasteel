import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { UserProfile, UserService } from '../../services/user.service';

@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.css'],
  imports: [CommonModule, TranslateModule],
  standalone: true,
})
export class UserDashboardComponent implements OnInit {
  user: UserProfile | null = null;
  loading = false;
  failed = false;

  constructor(
    private auth: AuthService,
    private users: UserService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    // The profile comes from the API, so this only runs in the browser.
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const id = this.auth.currentUserId();
    if (id === null) {
      this.failed = true;
      return;
    }

    this.loading = true;
    this.users.getById(id).subscribe({
      next: (user) => {
        this.user = user;
        this.loading = false;
      },
      error: () => {
        this.failed = true;
        this.loading = false;
      },
    });
  }
}
