import { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Download, ArrowRight, RefreshCw } from 'lucide-react';
import api from '../api/client';

export default function BulkImport() {
  const [step, setStep] = useState('upload'); // upload, preview, result
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState(null);
  const [errors, setErrors] = useState([]);
  const [result, setResult] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target.result);
    reader.readAsText(file);
  };

  const handleParse = async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    setErrors([]);
    try {
      const { data } = await api.post('/reports/bulk-import', { csvText });
      setPreview(data);
      setMapping(data.mapping);
      setStep('preview');
    } catch (err) {
      setErrors([{ row: 0, message: err.response?.data?.error || 'Parse failed' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/reports/bulk-confirm', { csvText, columnMapping: mapping });
      setResult(data);
      setStep('result');
    } catch (err) {
      setErrors([{ row: 0, message: err.response?.data?.error || 'Import failed' }]);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    window.open('/api/reports/import-template', '_blank');
  };

  const reset = () => {
    setStep('upload');
    setCsvText('');
    setFileName('');
    setPreview(null);
    setMapping(null);
    setErrors([]);
    setResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bulk Import</h1>
        <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Download size={16} /> Download Template
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {['Upload CSV', 'Preview & Map', 'Results'].map((label, i) => {
          const stepKeys = ['upload', 'preview', 'result'];
          const isActive = stepKeys.indexOf(step) >= i;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <ArrowRight size={14} className="text-gray-300" />}
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
            <Upload size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-600 mb-3">Upload a CSV file or paste CSV data below</p>
            <input type="file" accept=".csv" onChange={handleFile} className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload" className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-indigo-700">
              Choose CSV File
            </label>
            {fileName && <p className="mt-2 text-sm text-gray-500"><FileText size={14} className="inline mr-1" />{fileName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Or paste CSV data</label>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
              placeholder="offer_name,date,clicks,unique_clicks,conversions,revenue,payout&#10;Example Offer,2026-01-15,150,120,10,250.00,150.00"
            />
          </div>

          {errors.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg">
              {errors.map((e, i) => (
                <p key={i} className="text-sm text-red-700 flex items-center gap-1">
                  <AlertCircle size={14} /> {e.message}
                </p>
              ))}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button onClick={handleParse} disabled={!csvText.trim() || loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              Parse & Preview
            </button>
          </div>
        </div>
      )}

      {/* Preview Step */}
      {step === 'preview' && preview && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{preview.parsed}</p>
              <p className="text-xs text-gray-500">Rows Parsed</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{preview.matched}</p>
              <p className="text-xs text-gray-500">Offers Matched</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{preview.errors?.length || 0}</p>
              <p className="text-xs text-gray-500">Errors</p>
            </div>
          </div>

          {/* Column Mapping */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Column Mapping</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(mapping || {}).map(([csv, target]) => (
                <div key={csv} className="flex items-center gap-1 text-xs">
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600 truncate">{csv}</span>
                  <ArrowRight size={10} className="text-gray-400 shrink-0" />
                  <span className="px-2 py-0.5 bg-indigo-50 rounded text-indigo-700 truncate">{target}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Data Preview (first 20 rows)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Row</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Offer</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Clicks</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Conv</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Revenue</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Payout</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.preview?.map((row, i) => (
                    <tr key={i} className={row.offerMatched ? '' : 'bg-red-50'}>
                      <td className="px-3 py-1.5 text-gray-500">{row._row}</td>
                      <td className="px-3 py-1.5 text-gray-900 font-medium">{row.offerName}</td>
                      <td className="px-3 py-1.5 text-gray-600">{row.date}</td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{row.clicks}</td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{row.conversions}</td>
                      <td className="px-3 py-1.5 text-right text-green-600">${(row.revenue || 0).toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right text-blue-600">${(row.payout || 0).toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-center">
                        {row.offerMatched
                          ? <CheckCircle size={14} className="text-green-500 inline" />
                          : <AlertCircle size={14} className="text-red-500 inline" />
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Errors */}
          {preview.errors?.length > 0 && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <h3 className="text-sm font-semibold text-red-800 mb-2">Errors ({preview.errors.length})</h3>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {preview.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-700">Row {e.row}: {e.message}</p>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep('upload')} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Back
            </button>
            <button onClick={handleConfirm} disabled={loading || preview.matched === 0}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Confirm Import ({preview.matched} rows)
            </button>
          </div>
        </div>
      )}

      {/* Result Step */}
      {step === 'result' && result && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Import Complete</h2>
          <div className="flex justify-center gap-8 mb-6">
            <div>
              <p className="text-3xl font-bold text-green-600">{result.imported}</p>
              <p className="text-sm text-gray-500">Imported</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-red-600">{result.skipped}</p>
              <p className="text-sm text-gray-500">Skipped</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-400">{result.total}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <div className="text-left bg-red-50 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700">Row {e.row}: {e.reason}</p>
              ))}
            </div>
          )}
          <button onClick={reset} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            Import More
          </button>
        </div>
      )}
    </div>
  );
}
