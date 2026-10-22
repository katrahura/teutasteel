/**
 * The processing services the company offers.
 *
 * One list, used by the home page, the services page and the quote form. They used to be written
 * out on the home page alone; keeping the copy here is what stops a service existing on one screen
 * and not another, which is how the product forms came to disagree with each other.
 */
export interface ServiceOffering {
  /** Value the quote form receives, so a button can open it with this service already chosen. */
  id: string;
  /** Translation keys for the name and the description. */
  titleKey: string;
  textKey: string;
  image: string;
  /**
   * Which gallery entries show this service being done, counted from one in `PROJECTS`.
   *
   * The review asked the service pages to carry examples, and the gallery is where the examples
   * are. Written out by hand rather than matched by keyword: a link that says "here is this service
   * being done" has to be true, and the one entry with no photograph is deliberately in nobody's
   * list - landing on an empty slot is worse than no link at all.
   */
  sampleIndexes: number[];
}

export const SERVICES: ServiceOffering[] = [
  {
    id: 'cnc',
    titleKey: 'MISC.CNC_METAL_CUTTING',
    textKey: 'MISC.SERVICE_CNC_DESC',
    image: 'assets/images/services/cnc-fiber-laser-cutting.webp',
    // The cut plates and the decorative panels: both are CNC work.
    sampleIndexes: [3, 6],
  },
  {
    id: 'shears',
    titleKey: 'MISC.SHEET_METAL_CUTTING',
    textKey: 'MISC.SERVICE_PLATES_DESC',
    image: 'assets/images/services/hydraulic-shearing.webp',
    // The folded cover is cut on the guillotine before it is folded, and so is the tray.
    sampleIndexes: [4, 9],
  },
  {
    id: 'profiles',
    titleKey: 'MISC.PROFILE_AND_PIPE_CUTTING',
    textKey: 'MISC.SERVICE_PROFILES_DESC',
    image: 'assets/images/services/profile-pipe-cutting.webp',
    // Cut tubes for a gate, for a railing, and cut before being bent.
    sampleIndexes: [1, 2, 12],
  },
  {
    id: 'bending',
    titleKey: 'MISC.PIPE_BENDING',
    textKey: 'MISC.SERVICE_BENDING_DESC',
    image: 'assets/images/services/pipe-bending-simple.webp',
    // The five tubes bent to one template.
    sampleIndexes: [12],
  },
  {
    // A press brake is a different machine from the pipe roller above: it folds sheet and plate to
    // an angle, which is a service of its own and was missing from this list entirely.
    id: 'pressbrake',
    titleKey: 'MISC.PRESS_BRAKE_BENDING',
    textKey: 'MISC.SERVICE_PRESS_BRAKE_DESC',
    image: 'assets/images/services/press-brake-sheet-bending-simple.webp',
    // U-channels, a tray and a run of L-brackets. Three is enough to show the range.
    sampleIndexes: [7, 9, 11],
  },
  {
    id: 'complex',
    titleKey: 'MISC.COMPLEX_FABRICATION',
    textKey: 'MISC.SERVICE_COMPLEX_DESC',
    image: '',
    // A tray with relief cuts at the corners, and brackets cut and folded to a drawing.
    sampleIndexes: [9, 11],
  },
  {
    id: 'decoration',
    titleKey: 'MISC.PIPE_DECORATION',
    textKey: 'MISC.SERVICE_DECORATION_DESC',
    image: 'assets/images/services/pipe-decoration-simple.webp',
    // The decorative panels are the decorative work in the gallery.
    sampleIndexes: [6],
  },
];
