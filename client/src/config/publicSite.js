/**
 * Public legal/contact details used by the certification pages.
 *
 * Replace every value beginning with "[ADD" before deploying. Keeping these
 * values in one file prevents the Google application, privacy policy, contact
 * page, and product page from drifting apart.
 */
export const publicSite = Object.freeze({
  legalCompanyName: 'LAUNCHIGO MEDIA FZCO',
  contactEmail: '[ADD CORPORATE EMAIL, FOR EXAMPLE certification@ilaunchigo.com]',
  streetAddress: '001 DSO',
  city: 'Dubai',
  postalCode: 'P.O. Box 4455',
  country: 'United Arab Emirates',
  trackerDomain: 'go.trackscales.com',
  privacyEffectiveDate: '8 October 2026',
});

const requiredLegalFields = [
  'legalCompanyName',
  'contactEmail',
  'streetAddress',
  'city',
  'postalCode',
  'country',
];

export const missingLegalFields = requiredLegalFields.filter((key) =>
  String(publicSite[key]).startsWith('[ADD'),
);

export const hasPublishedContactEmail = !String(publicSite.contactEmail).startsWith('[ADD');

