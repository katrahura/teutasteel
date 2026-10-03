// Development defaults. The production build replaces this file with
// environment.production.ts (see the "fileReplacements" entry in angular.json).
export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:5000',
  cloudinaryBaseUrl: 'https://res.cloudinary.com/dy0idyurz/image/upload',
  siteUrl: 'http://localhost:4200',
  // Contact details live here so they only have to change in one place.
  whatsappNumber: '38344776650',
  contactEmail: 'info@teutasteel.com',
  location: {
    city: 'Gjilan',
    street: 'Rruga Idriz Seferi',
    number: '26',
  },
};
