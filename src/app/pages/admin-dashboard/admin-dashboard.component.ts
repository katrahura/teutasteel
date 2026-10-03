import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
  imports :[CommonModule, TranslateModule],
  standalone:true
})
export class AdminDashboardComponent {
  adminTools = ['Manage Users', 'Edit Content', 'View Reports'];
}
