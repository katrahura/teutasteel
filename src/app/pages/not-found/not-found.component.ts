import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
@Component({standalone:true,imports:[RouterModule,TranslateModule],template:`<section class="container py-5 text-center"><p>404</p><h1>{{ 'IMPROVE.NOT_FOUND' | translate }}</h1><p>{{ 'IMPROVE.NOT_FOUND_HELP' | translate }}</p><a class="btn btn-warning me-3" routerLink="/products">{{ 'NAVBAR.PRODUCTS' | translate }}</a><a class="btn btn-outline-dark" routerLink="/contact">{{ 'NAVBAR.CONTACT' | translate }}</a></section>`})
export class NotFoundComponent {}
