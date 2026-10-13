import { PROJECTS } from './projects';
import { SERVICES } from './services';

/**
 * The links between the two lists.
 *
 * A service points at gallery entries by their position, which is the one thing here that can break
 * silently: reorder the gallery and every link still works while pointing at the wrong job. These
 * check the two rules that matter - an example exists, and it has a photograph.
 */
describe('the services that point at the gallery', () => {
  it('gives every service at least one example', () => {
    for (const service of SERVICES) {
      expect(service.sampleIndexes.length)
        .withContext(service.id + ' has no example')
        .toBeGreaterThan(0);
    }
  });

  it('points every example at a real entry that has a photograph', () => {
    for (const service of SERVICES) {
      for (const index of service.sampleIndexes) {
        const project = PROJECTS[index - 1];
        expect(project).withContext(service.id + ' points past the end of the gallery').toBeDefined();
        // The stainless brackets are the one entry with no picture, and no service links to it:
        // landing on an empty slot is worse than having no link at all.
        expect(project.images.length)
          .withContext(service.id + ' points at the entry with no photograph')
          .toBeGreaterThan(0);
      }
    }
  });

  it('points each service at the work that used it', () => {
    const indexOf = (id: string) => PROJECTS.findIndex((project) => project.titleKey === id) + 1;

    // Named by their translation keys, so a reordering of the gallery fails here rather than in
    // front of a customer.
    const pressbrake = SERVICES.find((service) => service.id === 'pressbrake');
    expect(pressbrake?.sampleIndexes).toContain(indexOf('PROJECTS.P7_TITLE')); // bent U-channels
    expect(pressbrake?.sampleIndexes).toContain(indexOf('PROJECTS.P11_TITLE')); // L-brackets

    const pipeBending = SERVICES.find((service) => service.id === 'bending');
    expect(pipeBending?.sampleIndexes).toEqual([indexOf('PROJECTS.P12_TITLE')]); // tubes to a template

    const cnc = SERVICES.find((service) => service.id === 'cnc');
    expect(cnc?.sampleIndexes).toContain(indexOf('PROJECTS.P6_TITLE')); // decorative panels

    const decoration = SERVICES.find((service) => service.id === 'decoration');
    expect(decoration?.sampleIndexes).toEqual([indexOf('PROJECTS.P6_TITLE')]);
  });
});
