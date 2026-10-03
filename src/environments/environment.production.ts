// Production values, swapped in by the build's fileReplacements.
export const environment = {
  production: true,
  apiUrl: 'https://api.teutasteel.com',
  cloudinaryBaseUrl: 'https://res.cloudinary.com/dy0idyurz/image/upload',
  // Public address of the site itself: used for the canonical link and og:url, so
  // every page says which page it is instead of pointing at the home page.
  siteUrl: 'https://www.teutasteel.com',
  // Contact details live here so they only have to change in one place.
  whatsappNumber: '38344776650',
  contactEmail: 'info@teutasteel.com',
  // The address shown on the contact page. The map pin that goes with it is a
  // static src in contact.component.html (Angular refuses a bound iframe src), and
  // the same coordinates are in index.html's structured data.
  location: {
    city: 'Gjilan',
    street: 'Rruga Idriz Seferi',
    number: '26',
  },
};
