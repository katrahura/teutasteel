/**
 * The project gallery.
 *
 * Six entries, and a flag that says what they are. The words are translation keys, because the site
 * is read in two languages; the pictures are real files in `assets/gallery/`.
 *
 * These are SAMPLES. The text was written to show the shape of the page, the pictures came from an
 * image model, and neither describes work Teuta Steel has actually done - which is why the page
 * says so on it, and why it is deliberately left out of the sitemap and the page metadata: nobody
 * should be led to it by a search engine until it is real.
 *
 * To make it real: replace the six pictures in `assets/gallery/`, rewrite the P1..P6 keys in
 * `src/assets/i18n/al.json` and `en.json` with the real jobs, and set SAMPLE to false. The two
 * entries with no picture are waiting for one; their `photoKeys` say what to photograph.
 */
export interface Project {
  /** Translation keys for the words. */
  titleKey: string;
  typeKey: string;
  problemKey: string;
  suppliedKey: string;
  materialKey: string;
  serviceKey: string;
  /** What to photograph when the real job replaces this: the finished piece, then a close-up. */
  photoKeys: string[];
  /** The pictures that exist. An empty list is a slot inviting the photograph. */
  images: string[];
}

/** True while the entries below are examples rather than work that was done. */
export const SAMPLE = true;

export const PROJECTS: Project[] = [
  {
    titleKey: 'PROJECTS.P1_TITLE',
    typeKey: 'PROJECTS.P1_TYPE',
    problemKey: 'PROJECTS.P1_PROBLEM',
    suppliedKey: 'PROJECTS.P1_SUPPLIED',
    materialKey: 'PROJECTS.P1_MATERIAL',
    serviceKey: 'PROJECTS.P1_SERVICE',
    photoKeys: ['PROJECTS.P1_PHOTO_1', 'PROJECTS.P1_PHOTO_2'],
    images: ['assets/gallery/gate-finished.jpg', 'assets/gallery/gate-frame-detail.jpg'],
  },
  {
    titleKey: 'PROJECTS.P2_TITLE',
    typeKey: 'PROJECTS.P2_TYPE',
    problemKey: 'PROJECTS.P2_PROBLEM',
    suppliedKey: 'PROJECTS.P2_SUPPLIED',
    materialKey: 'PROJECTS.P2_MATERIAL',
    serviceKey: 'PROJECTS.P2_SERVICE',
    photoKeys: ['PROJECTS.P2_PHOTO_1', 'PROJECTS.P2_PHOTO_2'],
    images: ['assets/gallery/stair-railing.jpg'],
  },
  {
    titleKey: 'PROJECTS.P3_TITLE',
    typeKey: 'PROJECTS.P3_TYPE',
    problemKey: 'PROJECTS.P3_PROBLEM',
    suppliedKey: 'PROJECTS.P3_SUPPLIED',
    materialKey: 'PROJECTS.P3_MATERIAL',
    serviceKey: 'PROJECTS.P3_SERVICE',
    photoKeys: ['PROJECTS.P3_PHOTO_1', 'PROJECTS.P3_PHOTO_2'],
    // No picture of this one exists yet, and borrowing a neighbouring one would say something
    // untrue about a job. The slot says what to photograph instead.
    images: [],
  },
  {
    titleKey: 'PROJECTS.P4_TITLE',
    typeKey: 'PROJECTS.P4_TYPE',
    problemKey: 'PROJECTS.P4_PROBLEM',
    suppliedKey: 'PROJECTS.P4_SUPPLIED',
    materialKey: 'PROJECTS.P4_MATERIAL',
    serviceKey: 'PROJECTS.P4_SERVICE',
    photoKeys: ['PROJECTS.P4_PHOTO_1', 'PROJECTS.P4_PHOTO_2'],
    images: ['assets/gallery/press-brake-bending.jpg'],
  },
  {
    titleKey: 'PROJECTS.P5_TITLE',
    typeKey: 'PROJECTS.P5_TYPE',
    problemKey: 'PROJECTS.P5_PROBLEM',
    suppliedKey: 'PROJECTS.P5_SUPPLIED',
    materialKey: 'PROJECTS.P5_MATERIAL',
    serviceKey: 'PROJECTS.P5_SERVICE',
    photoKeys: ['PROJECTS.P5_PHOTO_1', 'PROJECTS.P5_PHOTO_2'],
    images: [],
  },
  {
    titleKey: 'PROJECTS.P6_TITLE',
    typeKey: 'PROJECTS.P6_TYPE',
    problemKey: 'PROJECTS.P6_PROBLEM',
    suppliedKey: 'PROJECTS.P6_SUPPLIED',
    materialKey: 'PROJECTS.P6_MATERIAL',
    serviceKey: 'PROJECTS.P6_SERVICE',
    photoKeys: ['PROJECTS.P6_PHOTO_1', 'PROJECTS.P6_PHOTO_2'],
    images: ['assets/gallery/decorative-panel.jpg'],
  },
];

/** The photograph of the workshop for the head of the page. */
export const PROJECTS_HEADER_IMAGE = 'assets/gallery/square-tubes-stock.jpg';
