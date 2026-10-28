import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SERVICES, ServiceOffering } from '../../shared/services';
import { PROJECTS } from '../../shared/projects';
import { environment } from '../../../environments/environment';
import { ContactService } from '../../services/contact.service';
import { ContentService } from '../../services/content.service';
import { SharedService } from '../../shared.service';

@Component({
  selector: 'app-service-detail', standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    <article class="service-detail" *ngIf="service as offering; else missing">
      <nav class="breadcrumbs" [attr.aria-label]="'JOURNEY.BREADCRUMB' | translate">
        <a routerLink="/">{{ 'NAVBAR.HOME' | translate }}</a><span aria-hidden="true">/</span>
        <a routerLink="/services">{{ 'NAVBAR.SERVICES' | translate }}</a><span aria-hidden="true">/</span>
        <span aria-current="page">{{ offering.titleKey | translate }}</span>
      </nav>
      <div class="service-intro">
        <div><p class="eyebrow">TEUTA STEEL · {{ location.city }}</p>
          <h1>{{ content.titleOf(offering, shared.lang || 'al', offering.titleKey | translate) }}</h1>
          <p class="lead">{{ content.textOf(offering, shared.lang || 'al', offering.textKey | translate) }}</p>
          <p class="note">{{ 'JOURNEY.SERVICE_NOTE' | translate }}</p>
          <a class="primary-action" routerLink="/request" [queryParams]="{service: offering.id}">{{ 'SERVICES.ASK' | translate }} <span aria-hidden="true">→</span></a>
        </div>
        <figure *ngIf="content.imageOf(offering)"><img [src]="content.imageOf(offering)" [alt]="content.altOf(offering, shared.lang || 'al', offering.titleKey | translate)" width="480" height="480">
          <figcaption>{{ 'JOURNEY.ILLUSTRATION' | translate }}</figcaption>
        </figure>
      </div>
      <section class="process" aria-labelledby="process-title">
        <h2 id="process-title">{{ 'JOURNEY.SERVICE_PROCESS' | translate }}</h2>
        <ol><li>{{ 'JOURNEY.STEP_1' | translate }}</li><li>{{ 'JOURNEY.STEP_2' | translate }}</li><li>{{ 'JOURNEY.STEP_3' | translate }}</li></ol>
        <a routerLink="/guides">{{ 'SERVICES.DRAWING_GUIDE' | translate }} <span aria-hidden="true">→</span></a>
      </section>
      <section class="example-section" *ngIf="examples.length">
        <h2>{{ 'JOURNEY.EXAMPLES' | translate }}</h2><p class="note">{{ 'JOURNEY.EXAMPLES_NOTE' | translate }}</p>
        <div class="example-grid"><a *ngFor="let example of examples" routerLink="/projects" [fragment]="example.anchor">
          <img [src]="example.image" [alt]="example.titleKey | translate" width="320" height="220" loading="lazy">
          <span>{{ example.titleKey | translate }} <span aria-hidden="true">→</span></span>
        </a></div>
      </section>
      <section class="contact-strip"><div><h2>{{ 'JOURNEY.CONTACT_TITLE' | translate }}</h2>
        <p>{{ contact.address() }} · {{ contact.hours() || ('SHELL.HOURS' | translate) }}</p></div>
        <a [href]="'tel:' + contact.phoneDial()">{{ contact.phoneDisplay() }}</a>
      </section>
      <a routerLink="/services">← {{ 'JOURNEY.BACK_SERVICES' | translate }}</a>
    </article>
    <ng-template #missing><section class="service-detail"><h1>{{ 'JOURNEY.NO_SERVICE' | translate }}</h1><a routerLink="/services">{{ 'JOURNEY.BACK_SERVICES' | translate }}</a></section></ng-template>
  `,
  styles: [`
    .service-detail{max-width:1180px;margin:0 auto;padding:32px 24px 64px;color:#111827}
    .breadcrumbs{display:flex;flex-wrap:wrap;gap:10px;font-size:13px;margin-bottom:36px;color:#64748b}
    a{color:#92400e;text-underline-offset:4px}a:focus-visible{outline:3px solid #b45309;outline-offset:4px}
    .service-intro{display:grid;grid-template-columns:1.15fr 1fr;align-items:center;gap:56px;margin-bottom:56px}
    h1{font-size:clamp(32px,4vw,50px);line-height:1.12;font-weight:800;letter-spacing:-.025em}
    h2{font-size:24px;font-weight:750;margin-bottom:16px}.eyebrow{font-size:12px;letter-spacing:.1em;color:#92400e;font-weight:700}
    .lead{font-size:19px;line-height:1.6;color:#475569;margin-top:20px}.note{color:#64748b;line-height:1.6}
    figure{margin:0}figure img{width:100%;height:auto;display:block;background:#f1f5f9;border-radius:16px}figcaption{font-size:12px;color:#64748b;margin-top:8px}
    .primary-action{display:inline-flex;align-items:center;gap:20px;background:#f59e0b;color:#111827;padding:15px 22px;border-radius:10px;text-decoration:none;font-weight:750;margin-top:12px;min-height:48px}
    .process{padding:32px;background:#f8fafc;border-radius:16px;margin-bottom:48px}ol{padding-left:22px}li{padding:7px 0 7px 8px;line-height:1.6}
    .example-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.example-grid a{border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;text-decoration:none;color:#111827}
    .example-grid img{width:100%;height:190px;object-fit:cover;display:block}.example-grid a>span{display:block;padding:16px;font-weight:600}
    .contact-strip{display:flex;align-items:center;justify-content:space-between;gap:24px;margin:48px 0 32px;border-top:1px solid #e5e7eb;padding-top:32px}.contact-strip p{color:#64748b;margin-bottom:0}.contact-strip>a{white-space:nowrap;font-size:20px;font-weight:700}
    @media(max-width:767px){.service-detail{padding:24px 18px 40px}.service-intro{grid-template-columns:1fr;gap:28px;margin-bottom:32px}.service-intro figure{max-width:360px;width:100%;margin:auto}.example-grid{grid-template-columns:1fr}.process{padding:24px}.contact-strip{align-items:flex-start;flex-direction:column}.breadcrumbs{margin-bottom:24px}}
  `]
})
export class ServiceDetailComponent {
  service?: ServiceOffering;
  readonly location = environment.location;
  /** The shop's saved details, with the built-in ones as fallback. */
  readonly contact = inject(ContactService);
  /** The owner's service copy, with the shipped words as fallback. */
  readonly content = inject(ContentService);
  readonly shared = inject(SharedService);
  constructor() {
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.service = SERVICES.find(service => service.id === params.get('id'));
    });
  }
  get examples() {
    return (this.service?.sampleIndexes || []).map(index => ({project:PROJECTS[index-1],index}))
      .filter(entry => entry.project?.images.length)
      .map(({project,index}) => ({titleKey:project.titleKey,image:project.images[0],anchor:'project-'+index}));
  }
}
