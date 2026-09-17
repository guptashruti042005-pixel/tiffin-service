import React, { useState } from 'react';
import api from '../services/api';

export default function TransferModal({ subscription, customers, onClose, onSuccess }) {
  const [newCustomerId, setNewCustomerId] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!subscription) return null;

  // Filter out the current customer from recipient options
  const eligibleCustomers = customers.filter(
    (c) => String(c._id) !== String(subscription.customerId?._id || subscription.customerId)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.transferSubscription(subscription._id, {
        newCustomerId,
        transferDate
      });
      onSuccess('Subscription transferred successfully! Plan and cycle were preserved.');
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
          <h3>T6: Transfer Subscription</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
          Transfer this subscription mid-cycle to a new customer. The plan and billing cycle will carry over, and billing will be split proportionally based on weekdays served.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Transfer To Customer *</label>
            <select
              className="form-select"
              value={newCustomerId}
              onChange={(e) => setNewCustomerId(e.target.value)}
              required
            >
              <option value="">-- Select Customer --</option>
              {eligibleCustomers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Effective Transfer Date *</label>
            <input
              type="date"
              className="form-input"
              value={transferDate}
              min={subscription.cycleStart}
              max={subscription.cycleEnd}
              onChange={(e) => setTransferDate(e.target.value)}
              required
            />
            <small style={{ color: '#64748b' }}>
              Cycle range: {subscription.cycleStart} to {subscription.cycleEnd}
            </small>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-info" disabled={loading}>
              {loading ? 'Transferring...' : 'Confirm Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
