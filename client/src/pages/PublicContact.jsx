import { Building2, Mail, MapPin } from 'lucide-react';
import PublicSiteLayout from '../components/public/PublicSiteLayout';
import { hasPublishedContactEmail, publicSite } from '../config/publicSite';

const details = [
  { label: 'Legal company name', value: publicSite.legalCompanyName, icon: Building2 },
];

export default function PublicContact() {
  return (
    <PublicSiteLayout
      eyebrow="Contact"
      title="Contact us"
      intro="Use these details for privacy, security, and service enquiries."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="contact-details" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 id="contact-details" className="text-xl font-semibold">Company details</h2>
          <dl className="mt-6 space-y-5">
            {details.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex gap-3">
                <Icon className="mt-0.5 shrink-0 text-blue-700" size={19} aria-hidden="true" />
                <div><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium break-words">{value}</dd></div>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="contact-address" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 id="contact-address" className="text-xl font-semibold">Address and email</h2>
          <div className="mt-6 flex gap-3">
            <MapPin className="mt-0.5 shrink-0 text-blue-700" size={19} aria-hidden="true" />
            <address className="not-italic text-sm leading-7 text-slate-700">
              {publicSite.streetAddress}<br />
              {publicSite.city}, {publicSite.postalCode}<br />
              {publicSite.country}
            </address>
          </div>
          <div className="mt-6 flex gap-3">
            <Mail className="mt-0.5 shrink-0 text-blue-700" size={19} aria-hidden="true" />
            <div>
              <p className="text-sm text-slate-500">Corporate contact email</p>
              {hasPublishedContactEmail ? (
                <a href={`mailto:${publicSite.contactEmail}`} className="mt-1 block break-all text-sm font-medium text-blue-700 underline">{publicSite.contactEmail}</a>
              ) : (
                <p className="mt-1 break-words text-sm font-medium">{publicSite.contactEmail}</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </PublicSiteLayout>
  );
}

