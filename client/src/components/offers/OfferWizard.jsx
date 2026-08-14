import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight, ChevronDown, Save, Check, X, Plus, Trash2 } from 'lucide-react';
import api from '../../api/client';

const STEPS = [
 { key: 'general', label: 'General' },
 { key: 'tracking', label: 'Tracking' },
 { key: 'revenue', label: 'Revenue & Payout' },
 { key: 'attribution', label: 'Attribution' },
 { key: 'targeting', label: 'Targeting' },
];

const CATEGORIES = [
 'Casino', 'Sports Betting', 'Poker', 'Bingo', 'Lottery',
 'Health/GLP-1', 'Finance', 'Crypto', 'Insurance', 'Education',
 'Lead Gen', 'E-commerce', 'Dating', 'VPN/Software', 'Other',
];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'BRL', 'NZD'];
const CHANNELS = ['SEO', 'PPC', 'Facebook', 'Google', 'Native', 'Email', 'Push', 'Display', 'TikTok', 'YouTube', 'Influencer', 'SMS'];
const DEVICE_TYPES = ['Desktop', 'Mobile', 'Tablet', 'Smart TV', 'Game Console'];
const OS_OPTIONS = ['iOS', 'Android', 'Windows', 'macOS', 'Linux', 'Chrome OS'];
const BROWSER_OPTIONS = ['Chrome', 'Safari', 'Firefox', 'Edge', 'Opera', 'Samsung Internet'];
const DEVICE_BRANDS = ['Apple', 'Samsung', 'Google', 'Huawei', 'Xiaomi', 'OnePlus'];
const CONNECTION_TYPES = ['WiFi', 'Cellular', 'Cable/DSL'];

const defaultForm = {
 // Step 1
 name: '', status: 'active', advertiser: '', category: '', currency: 'USD',
 thumbnail: '', offerGroup: '', labels: [], appIdentifier: '', previewUrl: '',
 internalNotes: '', channels: [], hasExpiration: false, expirationDate: '', description: '',
 // Step 2
 landingPageUrl: '', trackingDomain: '', linkingType: 'redirect',
 conversionTrackingMethod: 'server_postback', supportDeepLinks: false,
 enableCaps: false, dailyClickCap: 0, dailyConversionCap: 0, monthlyConversionCap: 0, totalCap: 0,
 offerVisibility: 'public', enableTerms: false, termsContent: '',
 uniqueSessionIdentifier: 'ip', sessionDuration: 24, sessionDurationUnit: 'hours',
 enableDuplicateFilter: true, redirectMode: '302',
 // Step 3
 baseEventName: 'Base', firePartnerPostback: false, manualApproveConversions: false,
 allowDuplicateConversions: false,
 revenueAction: 'conversion', revenueType: 'RPA', revenueAmount: 0, revenuePricePerProduct: false,
 payoutAction: 'conversion', payoutType: 'CPA', payoutAmount: 0, payoutPricePerProduct: false,
 events: [],
 // Step 4
 attributionMethod: 'last_click', enableThrottle: false, throttleRate: 0,
 enableClickToConversionTime: false, clickToConversionValue: 24, clickToConversionUnit: 'hours',
 enableEmailOwnership: false, enableServerSideClick: false,
 // Step 5
 deviceTypes: [], operatingSystems: [], osVersionMin: '', browsers: [],
 deviceBrands: [], connectionTypes: [], carriers: [],
 geoCountries: [], geoMode: 'include', geoRegions: [], geoCities: [],
 geoISP: [], enableIPBlock: false, ipBlocklist: '',
};

// ---- Shared UI components ----

function Label({ children, required }) {
 return <label className="block text-sm font-medium text-gray-700 mb-1">{children} {required && <span className="text-red-500">*</span>}</label>;
}

function Input({ label, required, value, onChange, placeholder, type = 'text', error, ...props }) {
 return (
 <div>
 <Label required={required}>{label}</Label>
 <input type={type} value={value ?? ''} onChange={(e) => onChange(type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value)}
 placeholder={placeholder} className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-900 ${error ? 'border-red-400' : 'border-gray-200'}`} {...props} />
 {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
 </div>
 );
}

function Select({ label, required, value, onChange, options, placeholder, error }) {
 return (
 <div>
 <Label required={required}>{label}</Label>
 <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}
 className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-900 ${error ? 'border-red-400' : 'border-gray-200'}`}>
 {placeholder && <option value="">{placeholder}</option>}
 {options.map((o) => {
 const val = typeof o === 'string' ? o : o.value;
 const lab = typeof o === 'string' ? o : o.label;
 return <option key={val} value={val}>{lab}</option>;
 })}
 </select>
 {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
 </div>
 );
}

function Toggle({ label, checked, onChange }) {
 return (
 <div className="flex items-center gap-3 cursor-pointer select-none" onClick={onChange} role="switch" aria-checked={checked} tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onChange())}>
 <div className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}>
 <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
 </div>
 <span className="text-sm text-gray-700">{label}</span>
 </div>
 );
}

function ChipSelect({ label, options, value = [], onChange }) {
 const toggle = (opt) => {
 if (value.includes(opt)) onChange(value.filter(v => v !== opt));
 else onChange([...value, opt]);
 };
 return (
 <div>
 <Label>{label}</Label>
 <div className="flex flex-wrap gap-2 mt-1">
 {options.map((opt) => (
 <button key={opt} type="button" onClick={() => toggle(opt)}
 className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
 value.includes(opt)
 ? 'bg-blue-100 text-blue-700 border-blue-300'
 : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
 }`}>{opt}</button>
 ))}
 </div>
 </div>
 );
}

function TagInput({ label, value = [], onChange, placeholder }) {
 const [input, setInput] = useState('');
 const add = () => {
 const tags = input.split(',').map(t => t.trim()).filter(Boolean);
 if (tags.length) { onChange([...new Set([...value, ...tags])]); setInput(''); }
 };
 return (
 <div>
 <Label>{label}</Label>
 <div className="flex flex-wrap gap-1.5 mb-2">
 {value.map(tag => (
 <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
 {tag}
 <button type="button" onClick={() => onChange(value.filter(t => t !== tag))} className="hover:text-blue-900"><X size={12} /></button>
 </span>
 ))}
 </div>
 <div className="flex gap-2">
 <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
 placeholder={placeholder || 'Type tags, comma-separated'} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
 <button type="button" onClick={add} className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 text-gray-700">Add</button>
 </div>
 </div>
 );
}

function SectionHeader({ children }) {
 return <h3 className="text-sm font-semibold text-gray-900 pt-4 pb-1 border-t border-gray-100 mt-4 first:mt-0 first:border-0 first:pt-0">{children}</h3>;
}

function Collapsible({ title, children, defaultOpen = false }) {
 const [open, setOpen] = useState(defaultOpen);
 return (
 <div className="border border-gray-100 rounded-lg">
 <button type="button" onClick={() => setOpen(!open)}
 className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
 {title}
 <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
 </button>
 {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
 </div>
 );
}

// ---- Step Components ----

function StepGeneral({ form, setField, advertisers, offerGroups, errors = {} }) {
 return (
 <div className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <Input label="Offer Name" required value={form.name} onChange={v => setField('name', v)} placeholder="BetMGM Casino US" error={errors.name} />
 <Select label="Status" required value={form.status} onChange={v => setField('status', v)}
 options={[{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }, { value: 'draft', label: 'Draft' }]} />
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <Select label="Advertiser" required value={form.advertiser} onChange={v => setField('advertiser', v)}
 options={advertisers.map(a => ({ value: a._id, label: a.name }))} placeholder="Select advertiser..." error={errors.advertiser} />
 <Select label="Category" value={form.category} onChange={v => setField('category', v)}
 options={CATEGORIES} placeholder="Select category..." />
 </div>
 <Select label="Currency" required value={form.currency} onChange={v => setField('currency', v)} options={CURRENCIES} />

 <Collapsible title="Optional Settings">
 <Input label="Thumbnail URL" value={form.thumbnail} onChange={v => setField('thumbnail', v)} placeholder="https://..." />
 <Select label="Offer Group" value={form.offerGroup} onChange={v => setField('offerGroup', v)}
 options={offerGroups.map(g => ({ value: g._id, label: g.name }))} placeholder="None" />
 <TagInput label="Labels" value={form.labels} onChange={v => setField('labels', v)} />
 <Input label="App Identifier" value={form.appIdentifier} onChange={v => setField('appIdentifier', v)} placeholder="com.example.app" />
 <Input label="Preview URL" value={form.previewUrl} onChange={v => setField('previewUrl', v)} placeholder="https://..." />
 <div>
 <Label>Internal Notes</Label>
 <textarea value={form.internalNotes ?? ''} onChange={e => setField('internalNotes', e.target.value)} rows={3}
 className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none resize-y focus:ring-2 focus:ring-blue-500" placeholder="Private notes..." />
 </div>
 <ChipSelect label="Channels" options={CHANNELS} value={form.channels} onChange={v => setField('channels', v)} />
 <div>
 <Toggle label="Set Expiration Date" checked={form.hasExpiration} onChange={() => setField('hasExpiration', !form.hasExpiration)} />
 {form.hasExpiration && (
 <div className="mt-2">
 <Input label="Expiration Date" type="date" value={form.expirationDate ? String(form.expirationDate).slice(0, 10) : ''} onChange={v => setField('expirationDate', v)} />
 </div>
 )}
 </div>
 <div>
 <Label>Description</Label>
 <textarea value={form.description ?? ''} onChange={e => setField('description', e.target.value)} rows={3}
 className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none resize-y focus:ring-2 focus:ring-blue-500" placeholder="Describe this offer..." />
 </div>
 </Collapsible>
 </div>
 );
}

function StepTracking({ form, setField, trackingDomains, errors = {} }) {
 return (
 <div className="space-y-4">
 <SectionHeader>Default Landing Page</SectionHeader>
 <Input label="Default Landing Page URL" required value={form.landingPageUrl} onChange={v => setField('landingPageUrl', v)} placeholder="https://advertiser.com/landing" error={errors.landingPageUrl} />

 <SectionHeader>Tracking Domain</SectionHeader>
 <Select label="Tracking Domain" value={form.trackingDomain} onChange={v => setField('trackingDomain', v)}
 options={trackingDomains.filter(d => d.status === 'verified').map(d => ({ value: d._id, label: d.domain }))}
 placeholder={trackingDomains.length === 0 ? 'Add tracking domain in Settings first' : 'Select domain...'} />

 <SectionHeader>Click Tracking</SectionHeader>
 <Select label="Linking Type" required value={form.linkingType} onChange={v => setField('linkingType', v)}
 options={[{ value: 'redirect', label: 'Redirect' }, { value: 'direct', label: 'Direct' }]} />

 <SectionHeader>Conversion Event Tracking</SectionHeader>
 <Select label="Conversion Tracking Method" required value={form.conversionTrackingMethod} onChange={v => setField('conversionTrackingMethod', v)}
 options={[
 { value: 'server_postback', label: 'Server Postback (S2S)' },
 { value: 'javascript_sdk', label: 'JavaScript SDK' },
 { value: 'iframe_pixel', label: 'iFrame Pixel' },
 ]} />

 <Collapsible title="Optional Tracking Settings">
 <Toggle label="Support Deep Links" checked={form.supportDeepLinks} onChange={() => setField('supportDeepLinks', !form.supportDeepLinks)} />

 <SectionHeader>Caps</SectionHeader>
 <Toggle label="Enable Caps" checked={form.enableCaps} onChange={() => setField('enableCaps', !form.enableCaps)} />
 {form.enableCaps && (
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
 <Input label="Daily Click Cap" type="number" value={form.dailyClickCap} onChange={v => setField('dailyClickCap', v)} />
 <Input label="Daily Conv. Cap" type="number" value={form.dailyConversionCap} onChange={v => setField('dailyConversionCap', v)} />
 <Input label="Monthly Conv. Cap" type="number" value={form.monthlyConversionCap} onChange={v => setField('monthlyConversionCap', v)} />
 <Input label="Total Cap" type="number" value={form.totalCap} onChange={v => setField('totalCap', v)} />
 </div>
 )}

 <SectionHeader>Controls</SectionHeader>
 <Select label="Offer Visibility" required value={form.offerVisibility} onChange={v => setField('offerVisibility', v)}
 options={[{ value: 'public', label: 'Public' }, { value: 'requires_approval', label: 'Requires Approval' }, { value: 'private', label: 'Private' }]} />
 <Toggle label="Enable Terms & Conditions" checked={form.enableTerms} onChange={() => setField('enableTerms', !form.enableTerms)} />
 {form.enableTerms && (
 <textarea value={form.termsContent ?? ''} onChange={e => setField('termsContent', e.target.value)} rows={3}
 className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none resize-y focus:ring-2 focus:ring-blue-500" placeholder="Terms & conditions..." />
 )}
 <Select label="Unique Session Identifier" required value={form.uniqueSessionIdentifier} onChange={v => setField('uniqueSessionIdentifier', v)}
 options={[{ value: 'ip', label: 'IP Address' }, { value: 'ip_ua', label: 'IP + User Agent' }, { value: 'cookie', label: 'Cookie' }, { value: 'device_id', label: 'Device ID' }]} />
 <div className="grid grid-cols-2 gap-4">
 <Input label="Session Duration" type="number" value={form.sessionDuration} onChange={v => setField('sessionDuration', v)} />
 <Select label="Duration Unit" value={form.sessionDurationUnit} onChange={v => setField('sessionDurationUnit', v)}
 options={[{ value: 'hours', label: 'Hours' }, { value: 'days', label: 'Days' }]} />
 </div>
 <Toggle label="Enable Duplicate Click Filter" checked={form.enableDuplicateFilter} onChange={() => setField('enableDuplicateFilter', !form.enableDuplicateFilter)} />
 <Select label="Redirect Mode" required value={form.redirectMode} onChange={v => setField('redirectMode', v)}
 options={[{ value: '302', label: '302 Redirect' }, { value: '301', label: '301 Redirect' }, { value: 'meta_refresh', label: 'Meta Refresh' }, { value: 'javascript', label: 'JavaScript Redirect' }]} />
 </Collapsible>
 </div>
 );
}

function StepRevenue({ form, setField }) {
 const addEvent = () => setField('events', [...(form.events || []), { name: '', revenueType: 'RPA', revenueAmount: 0, payoutType: 'CPA', payoutAmount: 0 }]);
 const removeEvent = (i) => setField('events', form.events.filter((_, idx) => idx !== i));
 const updateEvent = (i, key, val) => {
 const ev = [...form.events];
 ev[i] = { ...ev[i], [key]: val };
 setField('events', ev);
 };

 return (
 <div className="space-y-4">
 <SectionHeader>Base Conversion Event</SectionHeader>
 <Input label="Base Event Name" value={form.baseEventName} onChange={v => setField('baseEventName', v)} placeholder="Base" />

 <Collapsible title="Optional Settings">
 <Toggle label="Fire Partner Postback" checked={form.firePartnerPostback} onChange={() => setField('firePartnerPostback', !form.firePartnerPostback)} />
 <Toggle label="Manually Approve Conversions" checked={form.manualApproveConversions} onChange={() => setField('manualApproveConversions', !form.manualApproveConversions)} />
 <Toggle label="Allow Duplicate Conversions" checked={form.allowDuplicateConversions} onChange={() => setField('allowDuplicateConversions', !form.allowDuplicateConversions)} />
 </Collapsible>

 <div className="p-4 bg-green-50 rounded-lg border border-green-200">
 <h3 className="text-sm font-semibold text-green-800 mb-3">Base Revenue</h3>
 <p className="text-xs text-green-600 mb-3">How you receive earnings</p>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <Select label="Revenue Action" required value={form.revenueAction} onChange={v => setField('revenueAction', v)}
 options={[{ value: 'conversion', label: 'Conversion' }, { value: 'click', label: 'Click' }, { value: 'impression', label: 'Impression' }]} />
 <Select label="Revenue Type" required value={form.revenueType} onChange={v => setField('revenueType', v)}
 options={[{ value: 'RPA', label: 'RPA (Revenue Per Action)' }, { value: 'RPS', label: 'Revenue Per Sale (%)' }, { value: 'RPC', label: 'Revenue Per Click' }, { value: 'RPM', label: 'Revenue Per Mille' }]} />
 <Input label={form.revenueType === 'RPS' ? 'Revenue (%)' : 'Revenue Amount ($)'} type="number" value={form.revenueAmount} onChange={v => setField('revenueAmount', v)} placeholder="0.00" />
 </div>
 <div className="mt-3">
 <Toggle label="Price Per Product" checked={form.revenuePricePerProduct} onChange={() => setField('revenuePricePerProduct', !form.revenuePricePerProduct)} />
 </div>
 </div>

 <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
 <h3 className="text-sm font-semibold text-blue-800 mb-3">Base Payout</h3>
 <p className="text-xs text-blue-600 mb-3">How you pay partners</p>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <Select label="Payout Action" required value={form.payoutAction} onChange={v => setField('payoutAction', v)}
 options={[{ value: 'conversion', label: 'Conversion' }, { value: 'click', label: 'Click' }, { value: 'impression', label: 'Impression' }]} />
 <Select label="Payout Type" required value={form.payoutType} onChange={v => setField('payoutType', v)}
 options={[{ value: 'CPA', label: 'CPA (Cost Per Action)' }, { value: 'CPS', label: 'CPS (% of Sale)' }, { value: 'percent_revenue', label: '% of Revenue' }, { value: 'CPC', label: 'Cost Per Click' }, { value: 'CPM', label: 'CPM' }]} />
 <Input label={['CPS', 'percent_revenue'].includes(form.payoutType) ? 'Payout (%)' : 'Payout Amount ($)'} type="number" value={form.payoutAmount} onChange={v => setField('payoutAmount', v)} placeholder="0.00" />
 </div>
 <div className="mt-3">
 <Toggle label="Price Per Product" checked={form.payoutPricePerProduct} onChange={() => setField('payoutPricePerProduct', !form.payoutPricePerProduct)} />
 </div>
 </div>

 <Collapsible title="Additional Conversion Events">
 {form.events?.map((ev, i) => (
 <div key={i} className="p-3 border border-gray-200 rounded-lg bg-white">
 <div className="flex justify-between items-center mb-2">
 <span className="text-xs font-medium text-gray-500">Event #{i + 1}</span>
 <button type="button" onClick={() => removeEvent(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
 </div>
 <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
 <input value={ev.name} onChange={e => updateEvent(i, 'name', e.target.value)} placeholder="Event Name" className="px-2 py-1.5 border border-gray-200 rounded text-sm outline-none" />
 <select value={ev.revenueType} onChange={e => updateEvent(i, 'revenueType', e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded text-sm outline-none">
 <option value="RPA">RPA</option><option value="RPS">RPS</option>
 </select>
 <input type="number" value={ev.revenueAmount} onChange={e => updateEvent(i, 'revenueAmount', parseFloat(e.target.value) || 0)} placeholder="Revenue" className="px-2 py-1.5 border border-gray-200 rounded text-sm outline-none" />
 <select value={ev.payoutType} onChange={e => updateEvent(i, 'payoutType', e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded text-sm outline-none">
 <option value="CPA">CPA</option><option value="CPS">CPS</option>
 </select>
 <input type="number" value={ev.payoutAmount} onChange={e => updateEvent(i, 'payoutAmount', parseFloat(e.target.value) || 0)} placeholder="Payout" className="px-2 py-1.5 border border-gray-200 rounded text-sm outline-none" />
 </div>
 </div>
 ))}
 <button type="button" onClick={addEvent} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
 <Plus size={14} /> Add Event
 </button>
 </Collapsible>
 </div>
 );
}

function StepAttribution({ form, setField }) {
 return (
 <div className="space-y-4">
 <Select label="Attribution Method" value={form.attributionMethod} onChange={v => setField('attributionMethod', v)}
 options={[{ value: 'last_click', label: 'Last Click' }, { value: 'first_click', label: 'First Click' }]} />

 <div className="space-y-3">
 <Toggle label="Apply Throttle Rate" checked={form.enableThrottle} onChange={() => setField('enableThrottle', !form.enableThrottle)} />
 {form.enableThrottle && (
 <Input label="Throttle Rate (%)" type="number" value={form.throttleRate} onChange={v => setField('throttleRate', v)} placeholder="e.g. 50" />
 )}
 </div>

 <div className="space-y-3">
 <Toggle label="Enable Click to Conversion Time" checked={form.enableClickToConversionTime} onChange={() => setField('enableClickToConversionTime', !form.enableClickToConversionTime)} />
 {form.enableClickToConversionTime && (
 <div className="grid grid-cols-2 gap-4">
 <Input label="Max Time" type="number" value={form.clickToConversionValue} onChange={v => setField('clickToConversionValue', v)} />
 <Select label="Unit" value={form.clickToConversionUnit} onChange={v => setField('clickToConversionUnit', v)}
 options={[{ value: 'hours', label: 'Hours' }, { value: 'days', label: 'Days' }, { value: 'months', label: 'Months' }]} />
 </div>
 )}
 </div>

 <Toggle label="Enable Email Ownership" checked={form.enableEmailOwnership} onChange={() => setField('enableEmailOwnership', !form.enableEmailOwnership)} />
 <Toggle label="Enable Server-Side Click" checked={form.enableServerSideClick} onChange={() => setField('enableServerSideClick', !form.enableServerSideClick)} />

 <p className="text-xs text-gray-400 italic mt-6">All fields optional. Sensible defaults applied.</p>
 </div>
 );
}

function StepTargeting({ form, setField }) {
 return (
 <div className="space-y-4">
 <SectionHeader>Device Characteristics</SectionHeader>
 <ChipSelect label="Device Type" options={DEVICE_TYPES} value={form.deviceTypes} onChange={v => setField('deviceTypes', v)} />
 <ChipSelect label="Operating System" options={OS_OPTIONS} value={form.operatingSystems} onChange={v => setField('operatingSystems', v)} />
 <Input label="OS Version (min)" value={form.osVersionMin} onChange={v => setField('osVersionMin', v)} placeholder="e.g. iOS 15+" />
 <ChipSelect label="Browser" options={BROWSER_OPTIONS} value={form.browsers} onChange={v => setField('browsers', v)} />
 <ChipSelect label="Device Brand" options={DEVICE_BRANDS} value={form.deviceBrands} onChange={v => setField('deviceBrands', v)} />
 <ChipSelect label="Connection Type" options={CONNECTION_TYPES} value={form.connectionTypes} onChange={v => setField('connectionTypes', v)} />
 <TagInput label="Carrier" value={form.carriers} onChange={v => setField('carriers', v)} placeholder="Airtel, Jio, Verizon..." />

 <SectionHeader>Geolocation</SectionHeader>
 <TagInput label="Countries" value={form.geoCountries} onChange={v => setField('geoCountries', v)} placeholder="US, GB, IN..." />
 <div className="flex gap-4">
 <label className="flex items-center gap-2">
 <input type="radio" checked={form.geoMode === 'include'} onChange={() => setField('geoMode', 'include')} className="text-blue-600" />
 <span className="text-sm text-gray-700">Include (only selected)</span>
 </label>
 <label className="flex items-center gap-2">
 <input type="radio" checked={form.geoMode === 'exclude'} onChange={() => setField('geoMode', 'exclude')} className="text-blue-600" />
 <span className="text-sm text-gray-700">Exclude (all except)</span>
 </label>
 </div>
 <TagInput label="Regions / States" value={form.geoRegions} onChange={v => setField('geoRegions', v)} placeholder="California, New York..." />
 <TagInput label="Cities" value={form.geoCities} onChange={v => setField('geoCities', v)} placeholder="Los Angeles, Mumbai..." />
 <TagInput label="ISP" value={form.geoISP} onChange={v => setField('geoISP', v)} placeholder="ISP names..." />

 <div className="space-y-3">
 <Toggle label="Block Specific IPs" checked={form.enableIPBlock} onChange={() => setField('enableIPBlock', !form.enableIPBlock)} />
 {form.enableIPBlock && (
 <textarea value={form.ipBlocklist ?? ''} onChange={e => setField('ipBlocklist', e.target.value)} rows={3}
 className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none resize-y focus:ring-2 focus:ring-blue-500" placeholder="Enter IPs or CIDR ranges, one per line" />
 )}
 </div>

 {/* Targeting Summary */}
 {(form.geoCountries?.length > 0 || form.deviceTypes?.length > 0 || form.operatingSystems?.length > 0) && (
 <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
 <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Targeting Summary</h4>
 {form.geoCountries?.length > 0 && (
 <p className="text-sm text-gray-700">Countries ({form.geoMode}): {form.geoCountries.join(', ')}</p>
 )}
 {form.deviceTypes?.length > 0 && <p className="text-sm text-gray-700">Devices: {form.deviceTypes.join(', ')}</p>}
 {form.operatingSystems?.length > 0 && <p className="text-sm text-gray-700">OS: {form.operatingSystems.join(', ')}</p>}
 {form.browsers?.length > 0 && <p className="text-sm text-gray-700">Browsers: {form.browsers.join(', ')}</p>}
 </div>
 )}
 </div>
 );
}

// ---- Main Wizard ----

export default function OfferWizard({ offerId }) {
 const [step, setStep] = useState(0);
 const [form, setForm] = useState({ ...defaultForm });
 const [saving, setSaving] = useState(false);
 const [errors, setErrors] = useState({});
 const [loading, setLoading] = useState(!!offerId);
 const [advertisers, setAdvertisers] = useState([]);
 const [offerGroups, setOfferGroups] = useState([]);
 const [trackingDomains, setTrackingDomains] = useState([]);
 const navigate = useNavigate();

 useEffect(() => {
 // Fetch lookup data
 api.get('/advertisers').then(({ data }) => setAdvertisers(data.advertisers || [])).catch(() => {});
 api.get('/offer-groups').then(({ data }) => setOfferGroups(data.groups || data.offerGroups || [])).catch(() => {});
 api.get('/tracking-domains').then(({ data }) => setTrackingDomains(data.domains || [])).catch(() => {});

 if (offerId) {
 api.get(`/offers/${offerId}`).then(({ data }) => {
 const offer = data.offer;
 if (offer.advertiser && typeof offer.advertiser === 'object') offer.advertiser = offer.advertiser._id;
 if (offer.trackingDomain && typeof offer.trackingDomain === 'object') offer.trackingDomain = offer.trackingDomain._id;
 if (offer.expirationDate) offer.expirationDate = offer.expirationDate.slice(0, 10);
 setForm({ ...defaultForm, ...offer });
 setLoading(false);
 }).catch(() => navigate('/offers'));
 }
 }, [offerId]);

 const setField = (key, value) => {
 setForm(prev => ({ ...prev, [key]: value }));
 if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
 };

 const validateStep = (s) => {
 const errs = {};
 if (s === 0) {
 if (!form.name?.trim()) errs.name = 'Offer name is required';
 if (!form.advertiser) errs.advertiser = 'Advertiser is required';
 }
 if (s === 1) {
 if (!form.landingPageUrl?.trim()) errs.landingPageUrl = 'Landing page URL is required';
 }
 setErrors(errs);
 return Object.keys(errs).length === 0;
 };

 const goNext = () => {
 if (!validateStep(step)) return;
 setStep(s => Math.min(s + 1, STEPS.length - 1));
 };

 const goBack = () => setStep(s => Math.max(s - 1, 0));

 const save = async (isDraft) => {
 if (!isDraft && !validateStep(step)) return;
 setSaving(true);
 try {
 const payload = { ...form };
 if (isDraft) payload.status = 'draft';
 // Clean empty ObjectId ref fields — sending '' causes Mongoose CastError
 ['advertiser', 'trackingDomain', 'offerGroup'].forEach(key => {
 if (!payload[key]) delete payload[key];
 });
 if (offerId) {
 await api.put(`/offers/${offerId}`, payload);
 } else {
 await api.post('/offers', payload);
 }
 navigate('/offers');
 } catch (err) {
 setErrors({ _form: err.response?.data?.error || 'Save failed' });
 } finally {
 setSaving(false);
 }
 };

 if (loading) {
 return <div className="flex items-center justify-center h-64 text-gray-400">Loading offer...</div>;
 }

 const isLastStep = step === STEPS.length - 1;

 return (
 <div className="max-w-4xl mx-auto">
 <h1 className="text-2xl font-bold text-gray-900 mb-6">{offerId ? 'Edit Offer' : 'Create Offer'}</h1>

 {/* Progress Bar */}
 <div className="mb-8">
 <div className="flex items-center justify-between mb-2">
 {STEPS.map((s, i) => (
 <button key={s.key} type="button" onClick={() => i <= step && setStep(i)}
 className={`flex items-center gap-2 text-sm font-medium transition-colors ${
 i === step ? 'text-blue-600' : i < step ? 'text-green-600 cursor-pointer' : 'text-gray-400'
 }`}>
 <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
 i === step ? 'border-blue-600 bg-blue-600 text-white'
 : i < step ? 'border-green-500 bg-green-500 text-white'
 : 'border-gray-300 text-gray-400'
 }`}>
 {i < step ? <Check size={14} /> : i + 1}
 </span>
 <span className="hidden md:inline">{s.label}</span>
 </button>
 ))}
 </div>
 <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
 <div className="h-full bg-blue-600 transition-all duration-300 rounded-full" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
 </div>
 <p className="text-xs text-gray-400 mt-1">Step {step + 1} of {STEPS.length}</p>
 </div>

 {errors._form && (
 <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
 <AlertCircle size={16} /> {errors._form}
 </div>
 )}

 {/* Step Content */}
 <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[400px]">
 {step === 0 && <StepGeneral form={form} setField={setField} advertisers={advertisers} offerGroups={offerGroups} errors={errors} />}
 {step === 1 && <StepTracking form={form} setField={setField} trackingDomains={trackingDomains} errors={errors} />}
 {step === 2 && <StepRevenue form={form} setField={setField} />}
 {step === 3 && <StepAttribution form={form} setField={setField} />}
 {step === 4 && <StepTargeting form={form} setField={setField} />}
 </div>

 {/* Sticky Bottom Bar */}
 <div className="sticky bottom-0 mt-4 bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-lg">
 <div>
 {step > 0 && (
 <button type="button" onClick={goBack} className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
 <ChevronLeft size={16} /> Back
 </button>
 )}
 </div>
 <div className="flex items-center gap-3">
 <button type="button" onClick={() => navigate('/offers')} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
 <button type="button" onClick={() => save(true)} disabled={saving}
 className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
 <Save size={14} /> Save Draft
 </button>
 {isLastStep ? (
 <button type="button" onClick={() => save(false)} disabled={saving}
 className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
 <Check size={14} /> {saving ? 'Creating...' : 'Create Offer'}
 </button>
 ) : (
 <button type="button" onClick={goNext}
 className="flex items-center gap-1 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
 Next <ChevronRight size={16} />
 </button>
 )}
 </div>
 </div>
 </div>
 );
}
