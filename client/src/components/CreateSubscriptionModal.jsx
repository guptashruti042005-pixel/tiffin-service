import React, { useState } from 'react';
import api from '../services/api';

export default function CreateSubscriptionModal({ preselectedCustomer, customers, onClose, onSuccess }) {
  const [customerId, setCustomerId] = useState(preselectedCustomer?._id || '');
  const [planName, setPlanName] = useState('Standard Lunch Plan');
  const [monthlyPrice, setMonthlyPrice] = useState('2000');
  const [cycleStart, setCycleStart] = useState('2026-09-01');
  const [cycleEnd, setCycleEnd] = useState('2026-09-30');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.createSubscription({
        customerId,
        planName,
        monthlyPrice: Number(monthlyPrice),
        cycleStart,
        cycleEnd
      });
      onSuccess('Subscription created successfully.');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create Subscription</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Customer *</label>
            <select
              className="form-select"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">-- Select Customer --</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Plan Name *</label>
            <input
              type="text"
              className="form-input"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Monthly Plan Price (₹) *</label>
            <input
              type="number"
              className="form-input"
              min="1"
              step="0.01"
              value={monthlyPrice}
              onChange={(e) => setMonthlyPrice(e.target.value)}
              required
            />
            <small style={{ color: '#64748b' }}>
              Billed pro-rata by Monday-Friday service days only.
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">Cycle Start Date *</label>
            <input
              type="date"
              className="form-input"
              value={cycleStart}
              onChange={(e) => setCycleStart(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Cycle End Date *</label>
            <input
              type="date"
              className="form-input"
              value={cycleEnd}
              onChange={(e) => setCycleEnd(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Subscription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
