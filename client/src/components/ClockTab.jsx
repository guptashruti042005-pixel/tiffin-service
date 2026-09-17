import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export default function ClockTab() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [clockResult, setClockResult] = useState(null);
  const [outboxEvents, setOutboxEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchOutbox = useCallback(async () => {
    try {
      const data = await api.getOutbox();
      setOutboxEvents(data);
    } catch (err) {
      console.error('Failed to load outbox:', err);
    }
  }, []);

  useEffect(() => {
    fetchOutbox();
  }, [fetchOutbox]);

  const handleTriggerClock = async () => {
    setError('');
    setClockResult(null);
    setLoading(true);

    try {
      const res = await api.triggerClock({ date: selectedDate });
      setClockResult(res);
      await fetchOutbox();
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
          <span>T1: Morning Delivery Clock Integration</span>
        </div>

        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem' }}>
          Each morning, <code>POST /api/clock</code> identifies customers due a delivery today (active subscription, Monday-Friday weekday, not paused) and notifies them through the Notification Service. All dispatches are recorded to the Outbox.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Simulation Date:</label>
            <input
              type="date"
              className="form-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" onClick={handleTriggerClock} disabled={loading}>
            {loading ? 'Dispatching...' : 'Trigger Clock (POST /api/clock)'}
          </button>
        </div>

        {clockResult && (
          <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4>Result for {clockResult.date}:</h4>
            <p style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
              <strong>Weekday:</strong> {clockResult.isWeekday ? 'Yes (Mon-Fri)' : 'No (Weekend - Deliveries skipped)'}
            </p>
            <p style={{ fontSize: '0.9rem' }}>
              <strong>Notified Customers:</strong> {clockResult.notifiedCount}
            </p>

            {clockResult.notifications && clockResult.notifications.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                  {clockResult.notifications.map((n, i) => (
                    <li key={i}>
                      <strong>{n.customerName}</strong> ({n.phone}) — {n.plan}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <span>Outbox Activity (GET /outbox)</span>
          <button className="btn btn-secondary btn-sm" onClick={fetchOutbox}>
            Refresh
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
          Audit trail of delivery notifications dispatched by the Notification Service.
        </p>

        {outboxEvents.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No outbox events recorded yet. Trigger the clock above to dispatch notifications.</p>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Delivery Date</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {outboxEvents.map((evt) => (
                  <tr key={evt._id}>
                    <td>{new Date(evt.timestamp).toLocaleTimeString()} {new Date(evt.timestamp).toLocaleDateString()}</td>
                    <td><strong>{evt.customerId?.name || 'Customer'}</strong></td>
                    <td>{evt.customerId?.phone || ''}</td>
                    <td>{evt.date}</td>
                    <td><span className="badge badge-active">{evt.type}</span></td>
                    <td><span className="badge badge-active">{evt.status}</span></td>
                    <td style={{ fontSize: '0.8rem', color: '#475569' }}>{evt.payload?.message || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
