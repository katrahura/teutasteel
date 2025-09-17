import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.css'],
  imports:[TranslateModule],
  standalone:true
})
export class UserDashboardComponent {
  userInfo = {
    name: 'Regular User',
    email: 'user@example.com'
  };
}
