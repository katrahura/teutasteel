/**
 * The project gallery.
 *
 * Twelve entries, and a flag that says what they are. The words are translation keys, because the
 * site is read in two languages; the pictures are real files in `assets/gallery/`.
 *
 * These are SAMPLES. The pictures came from an image model and the text describes work in the shape
 * of the jobs this shop does, not jobs it has done - which is why the page says so on it, and why
 * it is deliberately left out of the sitemap and carries noindex: nobody should be led here by a
 * search engine until it is real.
 *
 * To make it real: replace the pictures in `assets/gallery/`, rewrite the P1..P12 keys in
 * `src/assets/i18n/al.json` and `en.json` with the real jobs, and set SAMPLE to false.
 *
 * One entry has no picture, and that is deliberate. The stainless brackets are the one job the
 * pictures do not show - everything here is untreated steel - and standing an untreated-steel
 * bracket in for it would label a photograph as something it is not. Its `photoKeys` say what to
 * photograph instead.
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

const picture = (name: string) => `assets/gallery/${name}`;

export const PROJECTS: Project[] = [
  {
    titleKey: 'PROJECTS.P1_TITLE',
    typeKey: 'PROJECTS.P1_TYPE',
    problemKey: 'PROJECTS.P1_PROBLEM',
    suppliedKey: 'PROJECTS.P1_SUPPLIED',
    materialKey: 'PROJECTS.P1_MATERIAL',
    serviceKey: 'PROJECTS.P1_SERVICE',
    photoKeys: ['PROJECTS.P1_PHOTO_1', 'PROJECTS.P1_PHOTO_2'],
    images: [picture('gate-finished.jpg'), picture('gate-frame-detail.jpg')],
  },
  {
    titleKey: 'PROJECTS.P2_TITLE',
    typeKey: 'PROJECTS.P2_TYPE',
    problemKey: 'PROJECTS.P2_PROBLEM',
    suppliedKey: 'PROJECTS.P2_SUPPLIED',
    materialKey: 'PROJECTS.P2_MATERIAL',
    serviceKey: 'PROJECTS.P2_SERVICE',
    photoKeys: ['PROJECTS.P2_PHOTO_1', 'PROJECTS.P2_PHOTO_2'],
    images: [picture('stair-railing.jpg')],
  },
  {
    titleKey: 'PROJECTS.P3_TITLE',
    typeKey: 'PROJECTS.P3_TYPE',
    problemKey: 'PROJECTS.P3_PROBLEM',
    suppliedKey: 'PROJECTS.P3_SUPPLIED',
    materialKey: 'PROJECTS.P3_MATERIAL',
    serviceKey: 'PROJECTS.P3_SERVICE',
    photoKeys: ['PROJECTS.P3_PHOTO_1', 'PROJECTS.P3_PHOTO_2'],
    images: [picture('plates-slotted.jpg')],
  },
  {
    titleKey: 'PROJECTS.P4_TITLE',
    typeKey: 'PROJECTS.P4_TYPE',
    problemKey: 'PROJECTS.P4_PROBLEM',
    suppliedKey: 'PROJECTS.P4_SUPPLIED',
    materialKey: 'PROJECTS.P4_MATERIAL',
    serviceKey: 'PROJECTS.P4_SERVICE',
    photoKeys: ['PROJECTS.P4_PHOTO_1', 'PROJECTS.P4_PHOTO_2'],
    // The finished cover, and the press brake that folded it.
    images: [picture('cover-folded.jpg'), picture('press-brake-bending.jpg')],
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
    // Two patterns: the leafy one that matches the shop's own motifs, and a geometric one.
    images: [picture('decorative-panel.jpg'), picture('panel-geometric.jpg')],
  },
  {
    titleKey: 'PROJECTS.P7_TITLE',
    typeKey: 'PROJECTS.P7_TYPE',
    problemKey: 'PROJECTS.P7_PROBLEM',
    suppliedKey: 'PROJECTS.P7_SUPPLIED',
    materialKey: 'PROJECTS.P7_MATERIAL',
    serviceKey: 'PROJECTS.P7_SERVICE',
    photoKeys: ['PROJECTS.P7_PHOTO_1', 'PROJECTS.P7_PHOTO_2'],
    images: [picture('profile-u.jpg')],
  },
  {
    titleKey: 'PROJECTS.P8_TITLE',
    typeKey: 'PROJECTS.P8_TYPE',
    problemKey: 'PROJECTS.P8_PROBLEM',
    suppliedKey: 'PROJECTS.P8_SUPPLIED',
    materialKey: 'PROJECTS.P8_MATERIAL',
    serviceKey: 'PROJECTS.P8_SERVICE',
    photoKeys: ['PROJECTS.P8_PHOTO_1', 'PROJECTS.P8_PHOTO_2'],
    images: [picture('profile-z.jpg')],
  },
  {
    titleKey: 'PROJECTS.P9_TITLE',
    typeKey: 'PROJECTS.P9_TYPE',
    problemKey: 'PROJECTS.P9_PROBLEM',
    suppliedKey: 'PROJECTS.P9_SUPPLIED',
    materialKey: 'PROJECTS.P9_MATERIAL',
    serviceKey: 'PROJECTS.P9_SERVICE',
    photoKeys: ['PROJECTS.P9_PHOTO_1', 'PROJECTS.P9_PHOTO_2'],
    images: [picture('tray-folded.jpg')],
  },
  {
    titleKey: 'PROJECTS.P10_TITLE',
    typeKey: 'PROJECTS.P10_TYPE',
    problemKey: 'PROJECTS.P10_PROBLEM',
    suppliedKey: 'PROJECTS.P10_SUPPLIED',
    materialKey: 'PROJECTS.P10_MATERIAL',
    serviceKey: 'PROJECTS.P10_SERVICE',
    photoKeys: ['PROJECTS.P10_PHOTO_1', 'PROJECTS.P10_PHOTO_2'],
    images: [picture('part-multi-bend.jpg')],
  },
  {
    titleKey: 'PROJECTS.P11_TITLE',
    typeKey: 'PROJECTS.P11_TYPE',
    problemKey: 'PROJECTS.P11_PROBLEM',
    suppliedKey: 'PROJECTS.P11_SUPPLIED',
    materialKey: 'PROJECTS.P11_MATERIAL',
    serviceKey: 'PROJECTS.P11_SERVICE',
    photoKeys: ['PROJECTS.P11_PHOTO_1', 'PROJECTS.P11_PHOTO_2'],
    images: [picture('brackets-l.jpg')],
  },
  {
    titleKey: 'PROJECTS.P12_TITLE',
    typeKey: 'PROJECTS.P12_TYPE',
    problemKey: 'PROJECTS.P12_PROBLEM',
    suppliedKey: 'PROJECTS.P12_SUPPLIED',
    materialKey: 'PROJECTS.P12_MATERIAL',
    serviceKey: 'PROJECTS.P12_SERVICE',
    photoKeys: ['PROJECTS.P12_PHOTO_1', 'PROJECTS.P12_PHOTO_2'],
    images: [picture('tubes-bent.jpg')],
  },
];

/**
 * The photograph at the head of the page: a spread of the things this shop prepares - plates,
 * brackets, square and round tube - which says more about the work than a rack of stock does.
 */
export const PROJECTS_HEADER_IMAGE = picture('kit-assorted.jpg');
