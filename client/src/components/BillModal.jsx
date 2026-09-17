import React from 'react';

export default function BillModal({ bill, onClose }) {
  if (!bill) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Subscription Pro-Rated Bill</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
          <p><strong>Customer:</strong> {bill.customer?.name} ({bill.customer?.phone})</p>
          <p><strong>Plan:</strong> {bill.plan} — ₹{bill.monthlyPrice}/month</p>
          <p><strong>Cycle:</strong> {bill.cycleStart} to {bill.cycleEnd}</p>
        </div>

        <div className="bill-summary">
          <div className="bill-stat">
            <div className="bill-stat-val">{bill.totalWeekdays}</div>
            <div className="bill-stat-lbl">Total Weekdays</div>
          </div>
          <div className="bill-stat">
            <div className="bill-stat-val" style={{ color: '#ef4444' }}>{bill.pausedWeekdays}</div>
            <div className="bill-stat-lbl">Paused Weekdays</div>
          </div>
          <div className="bill-stat">
            <div className="bill-stat-val" style={{ color: '#10b981' }}>{bill.servedWeekdays}</div>
            <div className="bill-stat-lbl">Served Weekdays</div>
          </div>
          <div className="bill-stat bill-amount-due">
            <div className="bill-stat-val">₹{bill.amountDue?.toFixed(2)}</div>
            <div className="bill-stat-lbl">Amount Due</div>
          </div>
        </div>

        {bill.pausePeriods && bill.pausePeriods.length > 0 ? (
          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Recorded Pause Periods:</h4>
            <table style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {bill.pausePeriods.map((p, idx) => (
                  <tr key={idx}>
                    <td>{p.startDate}</td>
                    <td>{p.endDate}</td>
                    <td>{p.reason || 'Not specified'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>
            No pauses recorded for this cycle (100% served).
          </p>
        )}

        {bill.segments && bill.segments.length > 1 && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#0284c7' }}>
              T6 Ownership Transfer Split Breakdown:
            </h4>
            <table style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Period</th>
                  <th>Served Days</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {bill.segments.map((seg, idx) => (
                  <tr key={idx}>
                    <td>{seg.customer?.name || seg.customerId}</td>
                    <td>{seg.startDate} to {seg.endDate}</td>
                    <td>{seg.servedWeekdays}</td>
                    <td><strong>₹{seg.amountDue?.toFixed(2)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
