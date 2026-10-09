import PublicSiteLayout from '../components/public/PublicSiteLayout';
import { hasPublishedContactEmail, publicSite } from '../config/publicSite';

const sections = [
  {
    title: 'Scope',
    body: `This policy applies to the click-tracking, advertising measurement, reporting, and conversion-attribution services operated by ${publicSite.legalCompanyName}, including the authenticated customer dashboard. Customers remain responsible for their advertisements, landing pages, privacy notices, legal bases, and instructions to us.`,
  },
  {
    title: 'Information processed',
    body: 'For tracked clicks, the service may process a generated click identifier, offer and campaign identifiers, source and sub-ID values supplied in the request, IP address, user-agent, referrer, approximate country/region/city derived from the IP address, device type, operating system, browser, click time, destination URL, response time, and bot, VPN, or duplicate indicators. Conversion records may include conversion identifiers, event names, timestamps, status, revenue, payout, and order-value information provided by the advertising network.',
  },
  {
    title: 'How information is used',
    body: 'We process this information to operate transparent redirects, attribute conversions, generate performance reports, detect duplicate or invalid traffic, secure and troubleshoot the service, measure reliability, and comply with applicable legal obligations. The service follows the destination supplied in the visible url parameter and does not substitute a hidden destination.',
  },
  {
    title: 'Legal basis and customer instructions',
    body: 'Depending on the applicable law and context, processing is performed to provide contracted services, follow customer instructions, protect legitimate interests in measurement and security, comply with law, or where required, based on consent obtained by the responsible advertiser or website operator.',
  },
  {
    title: 'Browser storage',
    body: 'The authenticated dashboard uses browser local storage to maintain sign-in information and basic account details. The transparent click redirect does not depend on dashboard sign-in storage. Customers are responsible for any cookie or similar-technology notices required on their own landing pages.',
  },
  {
    title: 'Sharing and service providers',
    body: 'Information may be processed by infrastructure, hosting, database, security, and communications providers that support our services. We may also disclose information when required by law, to protect rights and security, or as part of a corporate transaction subject to appropriate safeguards. We do not insert undisclosed third-party click trackers into the Google Ads redirect path.',
  },
  {
    title: 'International processing',
    body: 'Information may be processed in countries where we or our service providers operate. Where required by applicable law, we use appropriate contractual or other safeguards for international transfers.',
  },
  {
    title: 'Retention',
    body: 'Click and conversion information is retained only for as long as reasonably necessary to provide the service, meet legal obligations, resolve disputes, and enforce agreements. Data is deleted or anonymized when it is no longer reasonably required for these purposes.',
  },
  {
    title: 'Security',
    body: 'We use technical and organizational safeguards designed to protect information, including HTTPS transport, access controls, authenticated administrative functions, and operational monitoring. No security method can guarantee absolute protection.',
  },
  {
    title: 'Your choices and rights',
    body: 'Depending on your location, you may have rights to request access, correction, deletion, restriction, objection, portability, or withdrawal of consent. We may need to coordinate a request with the customer responsible for the relevant campaign and verify the requester before acting.',
  },
  {
    title: 'Changes to this policy',
    body: 'We may update this policy when our service, legal obligations, or processing practices change. The effective date shown on this page will be updated when material revisions are published.',
  },
];

export default function PrivacyPolicy() {
  return (
    <PublicSiteLayout
      eyebrow="Privacy"
      title="Privacy Policy"
      intro={`Effective ${publicSite.privacyEffectiveDate}. This policy explains how ${publicSite.legalCompanyName} processes information through the platform.`}
    >
      <article className="space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        {sections.map((section) => (
          <section key={section.title} aria-labelledby={`privacy-${section.title.toLowerCase().replaceAll(' ', '-')}`}>
            <h2 id={`privacy-${section.title.toLowerCase().replaceAll(' ', '-')}`} className="text-xl font-semibold">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{section.body}</p>
          </section>
        ))}

        <section aria-labelledby="privacy-contact" className="rounded-xl bg-slate-50 p-5">
          <h2 id="privacy-contact" className="text-xl font-semibold">Contact</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Privacy requests may be sent to{' '}
            {hasPublishedContactEmail ? (
              <a href={`mailto:${publicSite.contactEmail}`} className="font-medium text-blue-700 underline">{publicSite.contactEmail}</a>
            ) : (
              <strong>{publicSite.contactEmail}</strong>
            )}.
          </p>
          <address className="mt-3 whitespace-pre-line text-sm not-italic leading-6 text-slate-600">
            {publicSite.legalCompanyName}{'\n'}
            {publicSite.streetAddress}{'\n'}
            {publicSite.city}, {publicSite.postalCode}{'\n'}
            {publicSite.country}
          </address>
        </section>
      </article>
    </PublicSiteLayout>
  );
}

