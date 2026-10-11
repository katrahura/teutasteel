import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { PROJECTS, PROJECTS_HEADER_IMAGE, Project, SAMPLE } from '../../shared/projects';

/**
 * The project gallery: what the shop made, in its own words and its own photographs.
 *
 * The entries come from `shared/projects.ts`, which is also where the flag lives that says whether
 * these are examples. While it does, the page carries a Sample mark and each entry lists the
 * photographs that still have to be taken - which is the difference between a gallery that is
 * honest about being unfinished and one that quietly claims work it has not done.
 *
 * The page is deliberately absent from the sitemap and from the page metadata: it should not be
 * found by a search engine until there is something real to find.
 */
@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.css',
})
export class ProjectsComponent {
  readonly projects: Project[] = PROJECTS;
  readonly headerImage = PROJECTS_HEADER_IMAGE;
  readonly sample = SAMPLE;
}
