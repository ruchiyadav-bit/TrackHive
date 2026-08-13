import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings, Link2, DollarSign, Target, Clock, Image,
  AlertCircle, Save, Play, X, Plus, Trash2, ExternalLink,
  ChevronDown, FileStack, Download,
} from 'lucide-react';
import api from '../../api/client';
import {
  NETWORKS, CATEGORIES, VERTICALS, CHANNELS, CURRENCIES, STATUSES,
  REVENUE_TYPES, PAYOUT_TYPES, REVENUE_ACTIONS, CONVERSION_TYPES,
  CONVERSION_FLOWS, DEVICE_OPTIONS, OS_OPTIONS, BROWSER_OPTIONS,
  CONNECTION_OPTIONS, CREATIVE_TYPES, REDIRECT_TYPES, CAP_BEHAVIORS,
  IP_CAP_WINDOWS, UNIQUE_IDENTIFIERS, DUPLICATE_ACTIONS,
} from '../../utils/constants';

const TABS = [
  { key: 'general', label: 'General', icon: Settings },
  { key: 'urls', label: 'URLs & Tracking', icon: Link2 },
  { key: 'revenue', label: 'Revenue & Payout', icon: DollarSign },
  { key: 'targeting', label: 'Targeting', icon: Target },
  { key: 'caps', label: 'Caps & Schedule', icon: Clock },
  { key: 'creatives', label: 'Creatives', icon: Image },
];

const emptyEvent = {
  name: '', eventId: '', visibility: 'public',
  revenueType: 'CPA', revenueAmount: 0, payoutType: 'CPA', payoutAmount: 0, countTowardCap: true,
};

const emptyCreative = {
  type: 'banner', name: '', url: '', dimensions: '',
  clickUrl: '', altText: '', couponCode: '', couponExpiry: '', usageLimit: 0,
};

const emptyAdditionalUrl = { name: '', url: '', weight: 50 };

const defaultForm = {
  name: '', status: 'draft', thumbnail: '', advertiser: '', network: '',
  networkOfferId: '', currency: 'USD', category: '', subcategory: '',
  vertical: '', labels: [], channels: [], description: '', internalNotes: '',
  insertionOrderId: '',
  offerUrl: '', affiliateUrl: '', previewUrl: '', additionalUrls: [],
  deepLinking: false, redirectType: '302', postbackUrl: '', conversionPixel: '',
  smartLinkEnabled: false, smartLinkSlug: '', ipCap: 1, ipCapWindow: 'forever',
  ipCapWindowHours: 0, uniqueIdentifier: 'ip', duplicateAction: 'fallback',
  fallbackUrl: '', blockedPageMessage: 'This offer is no longer available.',
  botDetection: false, vpnDetection: false,
  revenueAction: 'conversion', revenueType: 'CPA', revenueAmount: 0, revenuePercent: 0,
  payoutAction: 'conversion', payoutType: 'CPA', payoutAmount: 0, payoutPercent: 0,
  conversionType: 'FTD', conversionFlow: '', payoutConditions: '', events: [],
  geoTargets: [], geoMode: 'whitelist', trafficSources: [], deviceTargets: [],
  osTargets: [], browserTargets: [], connectionTypes: [], ipBlocklist: '', redirectOnFail: '',
  dailyCap: 0, weeklyCap: 0, monthlyCap: 0, totalCap: 0,
  dailyRevenueCap: 0, monthlyRevenueCap: 0, dailyClickCap: 0,
  capBehavior: 'soft', startDate: '', expirationDate: '', timezone: 'UTC',
  creatives: [],
};

// Reusable field components
function FieldLabel({ label, required }) {
  return (
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

function TextInput({ label, required, value, onChange, placeholder, type = 'text', ...props }) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        {...props}
      />
    </div>
  );
}

function SelectInput({ label, required, value, onChange, options, placeholder }) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lab = typeof opt === 'string' ? opt : opt.label;
          return <option key={val} value={val}>{lab}</option>;
        })}
      </select>
    </div>
  );
}

function ToggleField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    </label>
  );
}

function MultiCheckbox({ label, options, value = [], onChange }) {
  const toggle = (opt) => {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  };
  return (
    <div>
      <FieldLabel label={label} />
      <div className="flex flex-wrap gap-2 mt-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              value.includes(opt)
                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function TagInput({ label, value = [], onChange }) {
  const [input, setInput] = useState('');
  const add = () => {
    const tags = input.split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length) {
      onChange([...new Set([...value, ...tags])]);
      setInput('');
    }
  };
  const remove = (tag) => onChange(value.filter((t) => t !== tag));
  return (
    <div>
      <FieldLabel label={label} />
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
            {tag}
            <button type="button" onClick={() => remove(tag)} className="hover:text-indigo-900 dark:hover:text-indigo-100">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Type tags, comma-separated"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <button type="button" onClick={add} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300">Add</button>
      </div>
    </div>
  );
}

// === TAB CONTENT COMPONENTS ===

function GeneralTab({ form, setField }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextInput label="Offer Name" required value={form.name} onChange={(v) => setField('name', v)} placeholder="BetMGM Casino US" />
        <SelectInput label="Status" required value={form.status} onChange={(v) => setField('status', v)} options={STATUSES} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextInput label="Advertiser / Brand" value={form.advertiser} onChange={(v) => setField('advertiser', v)} placeholder="BetMGM" />
        <SelectInput label="Network" required value={form.network} onChange={(v) => setField('network', v)} options={NETWORKS} placeholder="Select network..." />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TextInput label="Network Offer ID" value={form.networkOfferId} onChange={(v) => setField('networkOfferId', v)} placeholder="NET-12345" />
        <SelectInput label="Currency" required value={form.currency} onChange={(v) => setField('currency', v)} options={CURRENCIES} />
        <SelectInput label="Category" required value={form.category} onChange={(v) => setField('category', v)} options={CATEGORIES} placeholder="Select category..." />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextInput label="Subcategory" value={form.subcategory} onChange={(v) => setField('subcategory', v)} placeholder="Online Slots" />
        <SelectInput label="Vertical" value={form.vertical} onChange={(v) => setField('vertical', v)} options={VERTICALS} placeholder="Select vertical..." />
      </div>
      <TagInput label="Labels / Tags" value={form.labels} onChange={(v) => setField('labels', v)} />
      <MultiCheckbox label="Channels" options={CHANNELS} value={form.channels} onChange={(v) => setField('channels', v)} />
      <div>
        <FieldLabel label="Description (Public)" />
        <textarea
          value={form.description || ''}
          onChange={(e) => setField('description', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-y bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Describe this offer..."
        />
      </div>
      <div>
        <FieldLabel label="Internal Notes" />
        <textarea
          value={form.internalNotes || ''}
          onChange={(e) => setField('internalNotes', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-y bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Private notes (contacts, restrictions, etc.)..."
        />
      </div>
      <TextInput label="Insertion Order ID" value={form.insertionOrderId} onChange={(v) => setField('insertionOrderId', v)} placeholder="IO-2026-001" />
    </div>
  );
}

function UrlsTab({ form, setField }) {
  const addUrl = () => setField('additionalUrls', [...(form.additionalUrls || []), { ...emptyAdditionalUrl }]);
  const removeUrl = (i) => setField('additionalUrls', form.additionalUrls.filter((_, idx) => idx !== i));
  const updateUrl = (i, key, val) => {
    const urls = [...form.additionalUrls];
    urls[i] = { ...urls[i], [key]: val };
    setField('additionalUrls', urls);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <TextInput label="Offer URL (Landing Page)" required value={form.offerUrl} onChange={(v) => setField('offerUrl', v)} placeholder="https://example.com/landing" />
          {form.offerUrl && (
            <a href={form.offerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 mt-1 hover:underline">
              <ExternalLink size={12} /> Test link
            </a>
          )}
        </div>
        <div>
          <TextInput label="Affiliate Link" required value={form.affiliateUrl} onChange={(v) => setField('affiliateUrl', v)} placeholder="https://network.com/aff?id=..." />
          {form.affiliateUrl && (
            <a href={form.affiliateUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 mt-1 hover:underline">
              <ExternalLink size={12} /> Test link
            </a>
          )}
        </div>
      </div>
      <TextInput label="Preview URL" value={form.previewUrl} onChange={(v) => setField('previewUrl', v)} placeholder="https://example.com/preview" />

      {/* Additional URLs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel label="Additional URLs (Split Testing)" />
          <button type="button" onClick={addUrl} className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1">
            <Plus size={14} /> Add URL
          </button>
        </div>
        {form.additionalUrls?.map((url, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <input value={url.name} onChange={(e) => updateUrl(i, 'name', e.target.value)} placeholder="Name" className="w-32 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            <input value={url.url} onChange={(e) => updateUrl(i, 'url', e.target.value)} placeholder="URL" className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            <input type="number" value={url.weight} onChange={(e) => updateUrl(i, 'weight', parseInt(e.target.value) || 0)} className="w-16 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            <span className="text-xs text-gray-400 dark:text-gray-500">%</span>
            <button type="button" onClick={() => removeUrl(i)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ToggleField label="Deep Linking" checked={form.deepLinking} onChange={(v) => setField('deepLinking', !form.deepLinking)} />
        <SelectInput label="Redirect Type" value={form.redirectType} onChange={(v) => setField('redirectType', v)} options={REDIRECT_TYPES} />
      </div>

      <TextInput label="Postback URL (S2S)" value={form.postbackUrl} onChange={(v) => setField('postbackUrl', v)} placeholder="https://your-server.com/postback?click_id={click_id}" />

      <div>
        <FieldLabel label="Conversion Pixel" />
        <textarea
          value={form.conversionPixel || ''}
          onChange={(e) => setField('conversionPixel', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none resize-y bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="<script>...</script>"
        />
      </div>

      {/* Postback Macros */}
      <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Available Postback Macros</p>
        <div className="flex flex-wrap gap-1.5">
          {['{click_id}', '{offer_id}', '{payout}', '{revenue}', '{transaction_id}', '{sub1}', '{sub2}', '{sub3}', '{sub4}', '{sub5}', '{source_id}'].map((m) => (
            <code key={m} className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">{m}</code>
          ))}
        </div>
      </div>

      {/* Smart Link Section */}
      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Smart Link Settings</h3>
        <ToggleField label="Enable Smart Link" checked={form.smartLinkEnabled} onChange={() => setField('smartLinkEnabled', !form.smartLinkEnabled)} />

        {form.smartLinkEnabled && (
          <div className="mt-4 space-y-4 pl-4 border-l-2 border-indigo-200 dark:border-indigo-800">
            <TextInput label="Smart Link Slug" value={form.smartLinkSlug} onChange={(v) => setField('smartLinkSlug', v)} placeholder="betmgm-casino-us" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput label="IP Cap (Max Clicks Per IP)" type="number" value={form.ipCap} onChange={(v) => setField('ipCap', v)} />
              <SelectInput label="IP Cap Window" value={form.ipCapWindow} onChange={(v) => setField('ipCapWindow', v)} options={IP_CAP_WINDOWS} />
            </div>
            {form.ipCapWindow === 'custom' && (
              <TextInput label="Custom Window (hours)" type="number" value={form.ipCapWindowHours} onChange={(v) => setField('ipCapWindowHours', v)} />
            )}
            <SelectInput label="Unique Identifier" value={form.uniqueIdentifier} onChange={(v) => setField('uniqueIdentifier', v)} options={UNIQUE_IDENTIFIERS} />
            <SelectInput label="Duplicate Action" value={form.duplicateAction} onChange={(v) => setField('duplicateAction', v)} options={DUPLICATE_ACTIONS} />
            {form.duplicateAction === 'fallback' && (
              <TextInput label="Fallback URL" value={form.fallbackUrl} onChange={(v) => setField('fallbackUrl', v)} placeholder="https://example.com/expired" />
            )}
            {form.duplicateAction === 'blocked_page' && (
              <div>
                <FieldLabel label="Blocked Page Message" />
                <textarea value={form.blockedPageMessage || ''} onChange={(e) => setField('blockedPageMessage', e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none resize-y" />
              </div>
            )}
            <div className="flex gap-6">
              <ToggleField label="Bot Detection" checked={form.botDetection} onChange={() => setField('botDetection', !form.botDetection)} />
              <ToggleField label="VPN/Proxy Detection" checked={form.vpnDetection} onChange={() => setField('vpnDetection', !form.vpnDetection)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RevenueTab({ form, setField }) {
  const addEvent = () => setField('events', [...(form.events || []), { ...emptyEvent }]);
  const removeEvent = (i) => setField('events', form.events.filter((_, idx) => idx !== i));
  const updateEvent = (i, key, val) => {
    const events = [...form.events];
    events[i] = { ...events[i], [key]: val };
    setField('events', events);
  };

  const showRevenueAmount = ['CPA', 'CPC', 'CPM'].includes(form.revenueType);
  const showRevenuePercent = ['RPS', 'Hybrid'].includes(form.revenueType);
  const showPayoutAmount = ['CPA', 'CPL', 'CPI'].includes(form.payoutType);
  const showPayoutPercent = ['CPS', 'RevShare', 'PRV', 'Hybrid'].includes(form.payoutType);

  return (
    <div className="space-y-6">
      {/* Revenue */}
      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <h3 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-4">Revenue</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SelectInput label="Revenue Action" required value={form.revenueAction} onChange={(v) => setField('revenueAction', v)} options={REVENUE_ACTIONS} />
          <SelectInput label="Revenue Type" required value={form.revenueType} onChange={(v) => setField('revenueType', v)} options={REVENUE_TYPES} placeholder="Select..." />
          {showRevenueAmount && (
            <TextInput label="Revenue Amount ($)" type="number" value={form.revenueAmount} onChange={(v) => setField('revenueAmount', v)} placeholder="200.00" />
          )}
          {showRevenuePercent && (
            <TextInput label="Revenue Percentage (%)" type="number" value={form.revenuePercent} onChange={(v) => setField('revenuePercent', v)} placeholder="45" />
          )}
        </div>
      </div>

      {/* Payout */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-4">Payout</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SelectInput label="Payout Action" required value={form.payoutAction} onChange={(v) => setField('payoutAction', v)} options={REVENUE_ACTIONS} />
          <SelectInput label="Payout Type" required value={form.payoutType} onChange={(v) => setField('payoutType', v)} options={PAYOUT_TYPES} placeholder="Select..." />
          {showPayoutAmount && (
            <TextInput label="Payout Amount ($)" type="number" value={form.payoutAmount} onChange={(v) => setField('payoutAmount', v)} placeholder="150.00" />
          )}
          {showPayoutPercent && (
            <TextInput label="Payout Percentage (%)" type="number" value={form.payoutPercent} onChange={(v) => setField('payoutPercent', v)} placeholder="35" />
          )}
        </div>
      </div>

      {/* Conversion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectInput label="Default Conversion Type" required value={form.conversionType} onChange={(v) => setField('conversionType', v)} options={CONVERSION_TYPES} placeholder="Select..." />
        <SelectInput label="Conversion Flow" value={form.conversionFlow} onChange={(v) => setField('conversionFlow', v)} options={CONVERSION_FLOWS} placeholder="Select..." />
      </div>
      <div>
        <FieldLabel label="Payout Conditions" />
        <textarea value={form.payoutConditions || ''} onChange={(e) => setField('payoutConditions', e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none resize-y" placeholder="Minimum $20 deposit, US residents only..." />
      </div>

      {/* Additional Events */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <FieldLabel label="Additional Conversion Events" />
          <button type="button" onClick={addEvent} className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1">
            <Plus size={14} /> Add Event
          </button>
        </div>
        {form.events?.map((ev, i) => (
          <div key={i} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg mb-2 bg-white dark:bg-gray-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Event #{i + 1}</span>
              <button type="button" onClick={() => removeEvent(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <input value={ev.name} onChange={(e) => updateEvent(i, 'name', e.target.value)} placeholder="Event Name" className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              <input value={ev.eventId} onChange={(e) => updateEvent(i, 'eventId', e.target.value)} placeholder="Event ID" className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              <input type="number" value={ev.revenueAmount} onChange={(e) => updateEvent(i, 'revenueAmount', parseFloat(e.target.value) || 0)} placeholder="Revenue" className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              <input type="number" value={ev.payoutAmount} onChange={(e) => updateEvent(i, 'payoutAmount', parseFloat(e.target.value) || 0)} placeholder="Payout" className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TargetingTab({ form, setField }) {
  const [geoInput, setGeoInput] = useState('');
  const addGeo = () => {
    const codes = geoInput.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
    if (codes.length) {
      setField('geoTargets', [...new Set([...(form.geoTargets || []), ...codes])]);
      setGeoInput('');
    }
  };
  const removeGeo = (code) => setField('geoTargets', form.geoTargets.filter((g) => g !== code));

  return (
    <div className="space-y-6">
      {/* GEO */}
      <div>
        <FieldLabel label="GEO Targets" required />
        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.geoTargets?.map((code) => (
            <span key={code} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
              {code}
              <button type="button" onClick={() => removeGeo(code)} className="hover:text-blue-900 dark:hover:text-blue-100"><X size={12} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={geoInput}
            onChange={(e) => setGeoInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGeo())}
            placeholder="Country codes: US, GB, IN..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button type="button" onClick={addGeo} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300">Add</button>
        </div>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input type="radio" checked={form.geoMode === 'whitelist'} onChange={() => setField('geoMode', 'whitelist')} className="text-indigo-600" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Whitelist (only these)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={form.geoMode === 'blacklist'} onChange={() => setField('geoMode', 'blacklist')} className="text-indigo-600" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Blacklist (all except these)</span>
        </label>
      </div>

      <MultiCheckbox label="Allowed Traffic Sources" options={['SEO', 'PPC', 'Social', 'Email', 'Native', 'Push', 'Display', 'Content', 'Influencer']} value={form.trafficSources} onChange={(v) => setField('trafficSources', v)} />
      <MultiCheckbox label="Device Targets" options={DEVICE_OPTIONS} value={form.deviceTargets} onChange={(v) => setField('deviceTargets', v)} />
      <MultiCheckbox label="OS Targets" options={OS_OPTIONS} value={form.osTargets} onChange={(v) => setField('osTargets', v)} />
      <MultiCheckbox label="Browser Targets" options={BROWSER_OPTIONS} value={form.browserTargets} onChange={(v) => setField('browserTargets', v)} />
      <MultiCheckbox label="Connection Type" options={CONNECTION_OPTIONS} value={form.connectionTypes} onChange={(v) => setField('connectionTypes', v)} />

      <div>
        <FieldLabel label="IP Blocklist" />
        <textarea
          value={form.ipBlocklist || ''}
          onChange={(e) => setField('ipBlocklist', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none resize-y"
          placeholder="Enter IPs or CIDR ranges, one per line"
        />
      </div>
      <TextInput label="Redirect on Fail" value={form.redirectOnFail} onChange={(v) => setField('redirectOnFail', v)} placeholder="https://example.com/fallback" />
    </div>
  );
}

function CapsTab({ form, setField }) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Conversion Caps</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <TextInput label="Daily Cap" type="number" value={form.dailyCap} onChange={(v) => setField('dailyCap', v)} />
        <TextInput label="Weekly Cap" type="number" value={form.weeklyCap} onChange={(v) => setField('weeklyCap', v)} />
        <TextInput label="Monthly Cap" type="number" value={form.monthlyCap} onChange={(v) => setField('monthlyCap', v)} />
        <TextInput label="Total Cap (Lifetime)" type="number" value={form.totalCap} onChange={(v) => setField('totalCap', v)} />
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">Set to 0 for unlimited</p>

      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Revenue & Click Caps</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TextInput label="Daily Revenue Cap ($)" type="number" value={form.dailyRevenueCap} onChange={(v) => setField('dailyRevenueCap', v)} />
        <TextInput label="Monthly Revenue Cap ($)" type="number" value={form.monthlyRevenueCap} onChange={(v) => setField('monthlyRevenueCap', v)} />
        <TextInput label="Daily Click Cap" type="number" value={form.dailyClickCap} onChange={(v) => setField('dailyClickCap', v)} />
      </div>

      <SelectInput label="Cap Behavior" value={form.capBehavior} onChange={(v) => setField('capBehavior', v)} options={CAP_BEHAVIORS} />

      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Schedule</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TextInput label="Start Date" type="date" value={form.startDate ? form.startDate.slice(0, 10) : ''} onChange={(v) => setField('startDate', v)} />
        <TextInput label="Expiration Date" type="date" value={form.expirationDate ? form.expirationDate.slice(0, 10) : ''} onChange={(v) => setField('expirationDate', v)} />
        <TextInput label="Timezone" value={form.timezone} onChange={(v) => setField('timezone', v)} placeholder="UTC" />
      </div>
    </div>
  );
}

function CreativesTab({ form, setField }) {
  const addCreative = () => setField('creatives', [...(form.creatives || []), { ...emptyCreative }]);
  const removeCreative = (i) => setField('creatives', form.creatives.filter((_, idx) => idx !== i));
  const updateCreative = (i, key, val) => {
    const list = [...form.creatives];
    list[i] = { ...list[i], [key]: val };
    setField('creatives', list);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <FieldLabel label="Creatives & Assets" />
        <button type="button" onClick={addCreative} className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1">
          <Plus size={14} /> Add Creative
        </button>
      </div>

      {form.creatives?.length === 0 && (
        <div className="p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <Image size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-400 dark:text-gray-500">No creatives added yet</p>
        </div>
      )}

      {form.creatives?.map((cr, i) => (
        <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Creative #{i + 1}</span>
            <button type="button" onClick={() => removeCreative(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SelectInput label="Type" value={cr.type} onChange={(v) => updateCreative(i, 'type', v)} options={CREATIVE_TYPES} />
            <TextInput label="Name" value={cr.name} onChange={(v) => updateCreative(i, 'name', v)} placeholder="728x90 Banner" />
            <TextInput label="File URL" value={cr.url} onChange={(v) => updateCreative(i, 'url', v)} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <TextInput label="Dimensions" value={cr.dimensions} onChange={(v) => updateCreative(i, 'dimensions', v)} placeholder="728x90" />
            <TextInput label="Click URL" value={cr.clickUrl} onChange={(v) => updateCreative(i, 'clickUrl', v)} />
            <TextInput label="Alt Text" value={cr.altText} onChange={(v) => updateCreative(i, 'altText', v)} />
          </div>
          {cr.type === 'coupon' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <TextInput label="Coupon Code" value={cr.couponCode} onChange={(v) => updateCreative(i, 'couponCode', v)} />
              <TextInput label="Coupon Expiry" type="date" value={cr.couponExpiry} onChange={(v) => updateCreative(i, 'couponExpiry', v)} />
              <TextInput label="Usage Limit" type="number" value={cr.usageLimit} onChange={(v) => updateCreative(i, 'usageLimit', v)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// === MAIN OFFER FORM ===

export default function OfferForm({ offerId }) {
  const [form, setForm] = useState({ ...defaultForm });
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(!!offerId);
  const [templates, setTemplates] = useState([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [templateSaveModal, setTemplateSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (offerId) {
      api.get(`/offers/${offerId}`).then(({ data }) => {
        const offer = data.offer;
        if (offer.startDate) offer.startDate = offer.startDate.slice(0, 10);
        if (offer.expirationDate) offer.expirationDate = offer.expirationDate.slice(0, 10);
        setForm({ ...defaultForm, ...offer });
        setLoading(false);
      }).catch(() => {
        navigate('/offers');
      });
    }
  }, [offerId]);

  // Fetch templates list
  useEffect(() => {
    api.get('/templates').then(({ data }) => setTemplates(data.templates || [])).catch(() => {});
  }, []);

  const loadTemplate = (template) => {
    if (!template.templateData) return;
    setForm(prev => ({ ...prev, ...template.templateData }));
    setShowTemplateMenu(false);
  };

  const saveAsTemplate = async () => {
    if (!templateName) return;
    try {
      await api.post('/templates', { name: templateName, description: templateDesc, templateData: form });
      setTemplateSaveModal(false);
      setTemplateName('');
      setTemplateDesc('');
      // Refresh templates list
      const { data } = await api.get('/templates');
      setTemplates(data.templates || []);
    } catch (err) {
      console.error(err);
    }
  };

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name?.trim()) errs.name = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async (status) => {
    if (status === 'active' && !validate()) {
      setActiveTab('general');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, status: status || form.status };
      if (offerId) {
        await api.put(`/offers/${offerId}`, payload);
      } else {
        await api.post('/offers', payload);
      }
      navigate('/offers');
    } catch (err) {
      console.error('Save failed:', err);
      const msg = err.response?.data?.error || 'Save failed';
      setErrors({ _form: msg });
    } finally {
      setSaving(false);
    }
  };

  // Tab validation indicators
  const tabErrors = {
    general: !form.name?.trim(),
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">Loading offer...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {offerId ? 'Edit Offer' : 'Add Offer'}
        </h1>
        <div className="flex items-center gap-2">
          {/* Load Template */}
          <div className="relative">
            <button type="button" onClick={() => setShowTemplateMenu(!showTemplateMenu)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              <Download size={14} /> Load Template <ChevronDown size={12} />
            </button>
            {showTemplateMenu && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                {templates.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No templates available</p>
                ) : (
                  templates.map(t => (
                    <button key={t._id} type="button" onClick={() => loadTemplate(t)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{t.name}</span>
                      {t.description && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{t.description}</p>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {/* Save as Template */}
          <button type="button" onClick={() => setTemplateSaveModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            <FileStack size={14} /> Save as Template
          </button>
        </div>
      </div>

      {errors._form && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {errors._form}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const hasError = tabErrors[tab.key];
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors relative ${
                  activeTab === tab.key
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <Icon size={16} />
                {tab.label}
                {hasError && (
                  <span className="w-2 h-2 rounded-full bg-red-500 absolute top-2 right-2" />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {activeTab === 'general' && <GeneralTab form={form} setField={setField} />}
          {activeTab === 'urls' && <UrlsTab form={form} setField={setField} />}
          {activeTab === 'revenue' && <RevenueTab form={form} setField={setField} />}
          {activeTab === 'targeting' && <TargetingTab form={form} setField={setField} />}
          {activeTab === 'caps' && <CapsTab form={form} setField={setField} />}
          {activeTab === 'creatives' && <CreativesTab form={form} setField={setField} />}
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div className="sticky bottom-0 mt-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center justify-between shadow-lg">
        <button
          type="button"
          onClick={() => navigate('/offers')}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => save('draft')}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save size={14} /> Save as Draft
          </button>
          <button
            type="button"
            onClick={() => save('active')}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Play size={14} /> {saving ? 'Saving...' : 'Save & Activate'}
          </button>
        </div>
      </div>

      {/* Save as Template Modal */}
      {templateSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Save as Template</h2>
              <button type="button" onClick={() => setTemplateSaveModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name *</label>
                <input value={templateName} onChange={e => setTemplateName(e.target.value)}
                  placeholder="e.g. Standard CPA Offer"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea value={templateDesc} onChange={e => setTemplateDesc(e.target.value)}
                  rows={2} placeholder="Optional description..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-y" />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">Saves current form config (except name, status, stats) as a reusable template.</p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setTemplateSaveModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">Cancel</button>
              <button type="button" onClick={saveAsTemplate} disabled={!templateName}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
