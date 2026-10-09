import { CheckCircle2, Route, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import PublicSiteLayout from '../components/public/PublicSiteLayout';
import { publicSite } from '../config/publicSite';

const commitments = [
  'The next destination is visible in the url query parameter.',
  'The tracker responds with an HTTP 302 redirect to that visible destination.',
  'Destination domains are validated server-side against the selected offer.',
  'The service does not choose a hidden backend destination or use cloaking.',
  'No unspecified intermediate click-tracking domain is inserted by the service.',
  'Foreign parameters such as UTM values or affiliate IDs are not appended after the destination is rendered.',
];

const flow = [
  { label: 'Google Ads click', detail: 'The ad uses a transparent tracking template.' },
  { label: 'Tracking service', detail: 'The service records the click and validates the visible destination.' },
  { label: 'Advertiser landing page', detail: 'The visitor is sent directly to the URL shown in the url parameter.' },
];

export default function ClickTrackerInfo() {
  return (
    <PublicSiteLayout
      eyebrow="Transparent click tracking"
      title="Transparent click-tracker information"
      intro={`This service records advertising clicks, attributes conversions, and reports campaign performance. This page describes the transparent Google Ads click-tracking flow operated by ${publicSite.legalCompanyName}.`}
    >
      <div className="space-y-10">
        <section aria-labelledby="service-heading" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-1 shrink-0 text-blue-700" aria-hidden="true" />
            <div>
              <h2 id="service-heading" className="text-xl font-semibold">Service identification</h2>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-slate-500">Service</dt><dd className="mt-1 font-medium">Transparent click tracking</dd></div>
                <div><dt className="text-slate-500">Operator</dt><dd className="mt-1 font-medium">{publicSite.legalCompanyName}</dd></div>
                <div><dt className="text-slate-500">Tracking domain</dt><dd className="mt-1 font-mono text-blue-700">{publicSite.trackerDomain}</dd></div>
                <div><dt className="text-slate-500">Transparency parameter</dt><dd className="mt-1 font-mono text-blue-700">url</dd></div>
                <div><dt className="text-slate-500">Google Ads path</dt><dd className="mt-1 font-mono">/gclick</dd></div>
                <div><dt className="text-slate-500">Redirect type</dt><dd className="mt-1 font-medium">HTTP 302</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section aria-labelledby="flow-heading">
          <div className="flex items-center gap-3">
            <Route className="text-blue-700" aria-hidden="true" />
            <h2 id="flow-heading" className="text-2xl font-semibold">How a tracked click works</h2>
          </div>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {flow.map((step, index) => (
              <li key={step.label} className="rounded-xl border border-slate-200 bg-white p-5">
                <span className="text-sm font-semibold text-blue-700">Step {index + 1}</span>
                <h3 className="mt-2 font-semibold">{step.label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="commitments-heading" className="rounded-2xl bg-slate-900 p-6 text-white sm:p-8">
          <h2 id="commitments-heading" className="text-2xl font-semibold">Transparency commitments</h2>
          <ul className="mt-6 space-y-4">
            {commitments.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-slate-200">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" size={18} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="sample-heading">
          <h2 id="sample-heading" className="text-2xl font-semibold">Tracking URL format</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Customer-specific working examples are provided directly to advertising platforms during certification and review.
            The general transparent format is:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800"><code>https://{publicSite.trackerDomain}/gclick?offer_id=&lt;offer-id&gt;&amp;url=&lt;encoded-final-url&gt;</code></pre>
        </section>

        <section className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="font-semibold text-blue-950">Privacy and contact</h2>
          <p className="mt-2 text-sm leading-6 text-blue-900">
            See our <Link to="/privacy" className="font-semibold underline">Privacy Policy</Link> for the data processed by the service,
            or <Link to="/contact" className="font-semibold underline">contact us</Link> with certification and privacy questions.
          </p>
        </section>
      </div>
    </PublicSiteLayout>
  );
}

