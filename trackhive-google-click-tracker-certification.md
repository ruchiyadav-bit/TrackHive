# TrackHive: Google Ads Click Tracker Certification

Last updated: 9 October 2026

This document records the current Google Ads transparent click-tracker setup for the dashboard and `go.trackscales.com`.

Official Google guidance: https://support.google.com/google-ads/answer/13707399

---

## 1. Current setup

- Google Ads tracking endpoint: `/gclick`
- Certified tracking domain to submit: `go.trackscales.com`
- Transparency parameter: `url`
- Redirect response: HTTP 302
- Public tracker-information page: `https://trackgrowth.ilaunchigo.com/tracker-info`
- Privacy Policy: `https://trackgrowth.ilaunchigo.com/privacy`
- Contact page: `https://trackgrowth.ilaunchigo.com/contact`
- Legal operator: `LAUNCHIGO MEDIA FZCO`
- Registered address: `001 DSO, P.O. Box 4455, Dubai, United Arab Emirates`

The public route is `/tracker-info`. Do not use the old `/click-tracker` URL in the application.

The dashboard brand is not hard-coded. The name saved in **Settings > General > Website Name** appears in the login page, signup page, sidebar/header, public-page header, and browser title. If no name is available, the fallback is `TrackHive`.

---

## 2. Tracking template

Use this at campaign, ad group, or account level as required:

```text
https://go.trackscales.com/gclick?offer_id=REAL_OFFER_ID&url={lpurl}
```

How it works:

1. Google places the ad's final landing-page URL in `{lpurl}`.
2. The final destination remains visible in the `url` query parameter.
3. The server validates the destination domain against the selected offer.
4. A valid click receives one HTTP 302 redirect to that visible destination.
5. The service does not select a hidden backend destination or insert an unspecified intermediate tracking domain.
6. Foreign UTM or affiliate parameters are not appended after the destination has been rendered.

The `url` value must be the direct advertiser or merchant landing page. Do not put an affiliate-network redirect URL in `url`.

---

## 3. v5 deployment package

Use only this ZIP; it already includes all v4 certification-page changes:

```text
trackhive-google-certification-pages-v5-dynamic-website-name.zip
```

Upload it with FileZilla to:

```text
/root/everflow/public_html/
```

Then run in MobaXterm:

```bash
cd /root/everflow/public_html
unzip -o trackhive-google-certification-pages-v5-dynamic-website-name.zip -d .
cd client && npm run build
cd ..
pm2 restart trackhive
```

A PM2 restart is required because v5 adds a public API endpoint that returns only the saved Website Name. No private settings are exposed by this endpoint.

---

## 4. Required checks after deployment

- [ ] `https://trackgrowth.ilaunchigo.com/tracker-info` opens publicly and does not return 404.
- [ ] `https://trackgrowth.ilaunchigo.com/privacy` opens publicly.
- [ ] `https://trackgrowth.ilaunchigo.com/contact` opens publicly.
- [ ] Login, signup, sidebar/header, public header, and browser title show the saved **Website Name**.
- [ ] `Launchigo Click Tracking Service` is not displayed anywhere.
- [ ] `https://go.trackscales.com/gclick/health` works over valid HTTPS.
- [ ] `go.trackscales.com` has valid DNS and SSL configuration.
- [ ] A real active offer is available for the certification example.
- [ ] The real example redirects directly to the approved merchant landing-page domain.
- [ ] The redirect chain contains only one tracker hop before the final destination.
- [ ] The test click appears in dashboard logs.
- [ ] Google Ads' tracking-template test reaches the final URL without an error.

Example with a real active offer:

```text
https://go.trackscales.com/gclick?offer_id=REAL_OFFER_ID&url=https%3A%2F%2FMERCHANT-DOMAIN%2F
```

Negative tests:

- Missing `offer_id` must fail.
- Missing `url` must fail.
- A destination domain that is not allowed for the offer must fail.
- `/gclick` on an unrelated tracking domain must not be used for Google Ads.

---

## 5. Google form details

| Form field | Value to use |
|---|---|
| Legal company name | `LAUNCHIGO MEDIA FZCO` |
| Product/service name | Use the exact value saved in **Settings > General > Website Name**; default is `TrackHive` |
| Company address | `001 DSO, P.O. Box 4455, Dubai, United Arab Emirates` |
| Company website promoting the technology | `https://trackgrowth.ilaunchigo.com/tracker-info` |
| Privacy Policy URL | `https://trackgrowth.ilaunchigo.com/privacy` |
| Tracking domain | `go.trackscales.com` |
| Click-tracker path | `/gclick` |
| Transparency parameter | `url` |
| Redirect type | HTTP 302, one tracker hop, directly to the visible `url` destination |
| Working example | Use a real active offer and a direct approved merchant URL |
| Corporate email | Must be a real company-domain email; do not submit the placeholder |
| Certification contact | Real full name of the person responsible for the application |

Short English description for the form:

> Our service provides transparent click tracking for Google Ads. Google Ads clicks use `https://go.trackscales.com/gclick` with a visible `url` query parameter containing the next destination. The tracker validates the destination domain against the selected offer and issues an HTTP 302 redirect directly to that destination. It does not select a hidden backend destination, insert an unspecified intermediate tracking domain, or append foreign parameters after the destination is rendered.

---

## 6. Strict remaining items before form submission

The code and ZIP cannot complete these external requirements automatically:

- [ ] Replace the `contactEmail` placeholder in `client/src/config/publicSite.js` with a working corporate-domain email.
- [ ] Confirm the same corporate email is accessible to the certification contact.
- [ ] Prepare the certification contact's real full name.
- [ ] Prepare proof that the company owns or controls `go.trackscales.com` (for example, registrar/account evidence if requested).
- [ ] Create and test a real active offer whose landing URL is a direct merchant URL.
- [ ] Capture the final working tracker example after production deployment.
- [ ] Confirm that the company name, address, website, privacy URL, contact email, and form answers are consistent.

Do not submit the form while the public pages show the contact-email configuration warning.

---

## 7. Do not change these behaviours

- Do not add cloaking, conditional hidden destinations, or backend fallback redirects to `/gclick`.
- Do not add another undisclosed click-tracking domain between `go.trackscales.com` and the landing page.
- Do not use an affiliate-network redirect URL as the `url` destination.
- Do not replace `/gclick` with the older `/click` flow in Google Ads.
- Do not add a new Google Ads tracking path without updating the certification details.

Certification approval is decided by Google. Passing the technical checks reduces avoidable rejection risk but does not guarantee approval.
