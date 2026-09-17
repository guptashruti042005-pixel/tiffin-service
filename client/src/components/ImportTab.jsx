import React, { useState } from 'react';
import api from '../services/api';

const SAMPLE_MESSY_DATA = [
  {
    "name": "Kavita Shah",
    "phone": "+91 (982) 345-6789",
    "email": "kavita@example.com",
    "plan": "Veg Deluxe Tiffin",
    "monthlyPrice": 2200,
    "cycleStart": "01-09-2026",
    "cycleEnd": "30-09-2026"
  },
  {
    "name": "Kavita Shah (Duplicate)",
    "phone": "982-345-6789",
    "plan": "Evening Snack",
    "monthlyPrice": 1000
  },
  {
    "name": "Manoj Tiwari",
    "phone": "9871122334",
    "plan": "Executive Thali",
    "monthlyPrice": 2800,
    "cycleStart": "2026/09/01",
    "cycleEnd": "2026/09/30"
  },
  {
    "name": "",
    "phone": "9812345678",
    "plan": "Bad Row - Empty Name"
  },
  {
    "name": "Suresh BadPhone",
    "phone": "not_a_phone",
    "plan": "Invalid Phone"
  },
  {
    "name": "Deepak BadDate",
    "phone": "9898989898",
    "monthlyPrice": 2000,
    "cycleStart": "bad_date",
    "cycleEnd": "2026-09-30"
  }
];

export default function ImportTab({ onRefreshData }) {
  const [jsonInput, setJsonInput] = useState(JSON.stringify(SAMPLE_MESSY_DATA, null, 2));
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoadSample = () => {
    setJsonInput(JSON.stringify(SAMPLE_MESSY_DATA, null, 2));
    setReport(null);
    setError('');
  };

  const handleImport = async () => {
    setError('');
    setReport(null);
    setLoading(true);

    try {
      let parsed;
      try {
        parsed = JSON.parse(jsonInput);
      } catch (err) {
        throw new Error('Invalid JSON syntax: ' + err.message);
      }

      if (!Array.isArray(parsed)) {
        throw new Error('Import data must be a JSON array of customer records.');
      }

      const res = await api.importCustomers(parsed);
      setReport(res);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span>T4: Messy Customer Import</span>
          <button className="btn btn-secondary btn-sm" onClick={handleLoadSample}>
            Load Sample Messy Data
          </button>
        </div>

        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
          Batch import customers and subscriptions with varied phone formats, mixed date formats (DD-MM-YYYY, YYYY-MM-DD), and missing fields.
          Deterministic rules will import clean records, deduplicate repeated phones, and reject malformed records with explicit reasons.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label className="form-label">Customer Records (JSON Array):</label>
          <textarea
            className="form-textarea"
            rows="10"
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
          />
        </div>

        <div style={{ textAlign: 'right' }}>
          <button className="btn btn-primary" onClick={handleImport} disabled={loading}>
            {loading ? 'Processing Import...' : 'Run Import (POST /api/customers/import)'}
          </button>
        </div>
      </div>

      {report && (
        <div className="card">
          <div className="card-title">Import & Deduplication Report</div>

          <div className="bill-summary">
            <div className="bill-stat">
              <div className="bill-stat-val" style={{ color: '#10b981' }}>{report.imported}</div>
              <div className="bill-stat-lbl">Imported</div>
            </div>
            <div className="bill-stat">
              <div className="bill-stat-val" style={{ color: '#3b82f6' }}>{report.deduped}</div>
              <div className="bill-stat-lbl">Deduped</div>
            </div>
            <div className="bill-stat">
              <div className="bill-stat-val" style={{ color: '#ef4444' }}>{report.rejected}</div>
              <div className="bill-stat-lbl">Rejected</div>
            </div>
          </div>

          {report.errors && report.errors.length > 0 && (
            <div style={{ marginTop: '1.25rem' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#dc2626' }}>
                Rejected Records & Reasons:
              </h4>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Row</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.errors.map((err, idx) => (
                      <tr key={idx}>
                        <td><strong>#{err.row}</strong></td>
                        <td style={{ color: '#991b1b' }}>{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
