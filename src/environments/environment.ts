// Development defaults. The production build replaces this file with
// environment.production.ts (see the "fileReplacements" entry in angular.json).
export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:5000',
  cloudinaryBaseUrl: 'https://res.cloudinary.com/dy0idyurz/image/upload',
  siteUrl: 'http://localhost:4200',
  // Contact details live here so they only have to change in one place. There is one
  // exception: the telephone in index.html's structured data is in a static file, so it
  // has to be changed there as well.
  whatsappNumber: '38344776650',      // digits only: wa.me rejects a leading +
  whatsappDisplay: '+383 44 776 650',
  phone: '+38344133208',
  phoneDisplay: '+383 44 133 208',
  contactEmail: 'info@teutasteel.com',
  location: {
    city: 'Gjilan',
    street: 'Rruga Idriz Seferi',
    number: '26',
  },
};
