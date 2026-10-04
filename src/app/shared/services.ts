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
}

export const SERVICES: ServiceOffering[] = [
  {
    id: 'cnc',
    titleKey: 'MISC.CNC_METAL_CUTTING',
    textKey: 'MISC.SERVICE_CNC_DESC',
    image: 'assets/images/cnc.jpg',
  },
  {
    id: 'shears',
    titleKey: 'MISC.SHEET_METAL_CUTTING',
    textKey: 'MISC.SERVICE_PLATES_DESC',
    image: 'assets/images/hyd.webp',
  },
  {
    id: 'profiles',
    titleKey: 'MISC.PROFILE_AND_PIPE_CUTTING',
    textKey: 'MISC.SERVICE_PROFILES_DESC',
    image: 'assets/images/profiles.jpg',
  },
  {
    id: 'bending',
    titleKey: 'MISC.PIPE_BENDING',
    textKey: 'MISC.SERVICE_BENDING_DESC',
    image: 'assets/images/bend.webp',
  },
  {
    // A press brake is a different machine from the pipe roller above: it folds sheet and plate to
    // an angle, which is a service of its own and was missing from this list entirely.
    id: 'pressbrake',
    titleKey: 'MISC.PRESS_BRAKE_BENDING',
    textKey: 'MISC.SERVICE_PRESS_BRAKE_DESC',
    image: '',
  },
  {
    id: 'complex',
    titleKey: 'MISC.COMPLEX_FABRICATION',
    textKey: 'MISC.SERVICE_COMPLEX_DESC',
    image: '',
  },
  {
    id: 'decoration',
    titleKey: 'MISC.PIPE_DECORATION',
    textKey: 'MISC.SERVICE_DECORATION_DESC',
    image: 'assets/images/decor.webp',
  },
];
