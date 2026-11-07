import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
@Component({selector: 'app-catalogue-shortcuts', standalone:true, imports:[RouterModule,TranslateModule],
 template:`<nav class="shortcuts" [attr.aria-label]="'IMPROVE.EXPLORE' | translate">
 <a routerLink="/products" [queryParams]="{category:113}">{{ 'IMPROVE.POLYCARBONATE' | translate }}</a>
 <a routerLink="/products" [queryParams]="{category:111}">{{ 'IMPROVE.MESH' | translate }}</a>
 <a routerLink="/products" [queryParams]="{category:112}">{{ 'IMPROVE.GRATING' | translate }}</a>
 </nav>`,styles:[`.shortcuts{display:flex;gap:10px;flex-wrap:wrap;padding:16px;max-width:1200px;margin:auto}.shortcuts a{display:flex;align-items:center;min-height:44px;padding:10px 16px;border:1px solid #cbd5e1;border-radius:8px;color:#17212b;background:#f8fafc;font-weight:600;text-decoration:none}.shortcuts a:focus-visible{outline:3px solid #eaa22f;outline-offset:3px}`]})
export class CatalogueShortcutsComponent {}
