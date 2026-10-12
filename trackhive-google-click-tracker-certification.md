# TrackHive: Google Ads Click Tracker Certification

Last updated: 12 October 2026

This document records the current Google Ads transparent click-tracker setup for the dashboard and `go.trackscales.com`.

Official Google guidance: https://support.google.com/google-ads/answer/13707399

---

## 1. Current setup

- Google Ads tracking endpoint: `/gclick`
- Certified tracking domain to submit: `go.trackscales.com`
- Transparency parameter: `url`
- Required service parameter: `offer_id`
- Conditional Google parallel-tracking parameter: `gb=1` (accepted only when `url` is Google's exact HTTPS `/asnc` callback)
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
3. For a normal/non-parallel request, the server validates the destination domain against the selected offer.
4. A valid request receives one HTTP 302 redirect to the exact visible `url` value.
5. The service does not select a hidden backend destination or insert an unspecified intermediate tracking domain.
6. The tracker does not expand custom macros or append UTM, affiliate, `sub1`-`sub5`, or source parameters.

Google parallel tracking:

- The Google Ads template remains exactly the template shown above; never paste a `google.com/asnc` URL into the template.
- During Google's parallel-tracking test, Google can replace `{lpurl}` with an HTTPS `https://www.google.com/asnc...` callback and can add `gb=1`.
- The service accepts this exception only for host `www.google.com`, path `/asnc` or `/asnc/...`, HTTPS, and optional `gb=1`.
- Arbitrary Google URLs, other extra parameters, duplicate values, and any `gb` value other than `1` are rejected.
- In parallel mode the user reaches the ad Final URL directly; the background tracker redirects only to the visible Google `/asnc` callback.

For normal/non-parallel requests, the `url` value must be the direct advertiser or merchant landing page. Do not put an affiliate-network redirect URL in `url`. Google's exact `/asnc` callback is the only parallel-tracking exception.

---

## 3. Supported parameters to disclose

| Parameter | Required | Meaning |
|---|---:|---|
| `offer_id` | Yes | Internal offer identifier used to select the approved landing-page-domain allowlist and record the click. It does not choose a hidden redirect destination. |
| `url` | Yes | Visible next immediate hop. The tracker redirects to this exact value after validation. |
| `gb` | Conditional | Google-supplied parallel-tracking flag. Only literal `gb=1` is accepted, and only when `url` is the exact HTTPS `www.google.com/asnc...` callback. It does not alter the redirect destination. |

No other `/gclick` parameters or macros are supported. Parameters used by the separate landing-page button route `/click` are not `/gclick` parameters and must not be listed as such.

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
- [ ] Google Ads' tracking-template test shows **Landing page found** and **Tracking call successful** for both parallel and non-parallel samples.
- [ ] Every ad/ad group covered by the tested template uses the intended offer ID and an allowed Final URL; no red sample remains in the evidence submitted to Google.

Example with a real active offer:

```text
https://go.trackscales.com/gclick?offer_id=REAL_OFFER_ID&url=https%3A%2F%2FMERCHANT-DOMAIN%2F
```

Negative tests:

- Missing `offer_id` must fail.
- Missing `url` must fail.
- A destination domain that is not allowed for the offer must fail.
- An unknown query parameter must fail.
- `gb` without an exact HTTPS `www.google.com/asnc...` callback must fail.
- A Google `/asnc` callback with a `gb` value other than `1` must fail.
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
| Supported parameters | `offer_id`, `url`, plus conditional Google-owned `gb=1` for the exact HTTPS `www.google.com/asnc...` parallel callback |
| Transparency parameter | `url` (always contains the visible next immediate hop) |
| Redirect type | HTTP 302, one tracker hop, directly to the visible `url` destination |
| Working example | Use a real active offer and a direct approved merchant URL |
| Corporate email | Must be a real company-domain email; do not submit the placeholder |
| Certification contact | Real full name of the person responsible for the application |

Short English description for the form:

> Our service provides transparent click tracking for Google Ads. Google Ads clicks use `https://go.trackscales.com/gclick` with a visible `url` query parameter containing the next destination. The tracker validates the destination domain against the selected offer and issues an HTTP 302 redirect directly to that destination. It does not select a hidden backend destination, insert an unspecified intermediate tracking domain, or append foreign parameters after the destination is rendered.

Parallel-tracking disclosure for the form or reviewer:

> The supported service parameters are `offer_id` and `url`. When Google performs parallel tracking, Google may additionally send `gb=1` and replace `{lpurl}` with its HTTPS `www.google.com/asnc...` callback. The tracker accepts that conditional parameter only for the exact Google callback and redirects to the unchanged visible `url`; it does not use `gb` to select another destination.

---

## 6. Landing-page review checklist

Tracker certification and Google Ads landing-page review are separate checks. For the real certification example, the landing page should:

- return successfully over HTTPS on desktop and mobile and allow Google AdsBot crawling;
- use the same Final URL/display domain configured in the ad;
- contain useful, original content relevant to the ad rather than being a one-button bridge page;
- never auto-redirect to the affiliate/merchant tracking URL;
- open the relevant merchant destination only after a genuine user button click;
- avoid misleading claims, fake warnings, forced pop-ups, hidden click areas, or back-button interference; and
- include accurate privacy/contact disclosures wherever data collection or the promoted vertical requires them.

A green Google Ads tracking-template test proves the technical URL flow only. It does not by itself approve the landing page or guarantee certification.

---

## 7. Strict remaining items before form submission

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

## 8. Do not change these behaviours

- Do not add cloaking, conditional hidden destinations, or backend fallback redirects to `/gclick`.
- Do not add another undisclosed click-tracking domain between `go.trackscales.com` and the landing page.
- Do not use an affiliate-network redirect URL as the `url` destination.
- Do not treat Google `/asnc` as the user's landing page; it is only Google's background callback during parallel tracking.
- Do not accept `gb` for normal destinations or broaden the `/asnc` exception beyond the exact Google host/path rule.
- Do not replace `/gclick` with the older `/click` flow in Google Ads.
- Do not add a new Google Ads tracking path without updating the certification details.

Certification approval is decided by Google. Passing the technical checks reduces avoidable rejection risk but does not guarantee approval.
