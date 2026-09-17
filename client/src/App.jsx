import React, { useState, useEffect, useCallback } from 'react';
import api from './services/api';
import './App.css';

import BillModal from './components/BillModal';
import PauseModal from './components/PauseModal';
import TransferModal from './components/TransferModal';
import CreateCustomerModal from './components/CreateCustomerModal';
import CreateSubscriptionModal from './components/CreateSubscriptionModal';
import ImportTab from './components/ImportTab';
import ClockTab from './components/ClockTab';

export default function App() {
  const [activeTab, setActiveTab] = useState('customers');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters
  const [searchPhone, setSearchPhone] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [selectedBill, setSelectedBill] = useState(null);
  const [pauseSub, setPauseSub] = useState(null);
  const [transferSub, setTransferSub] = useState(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [addSubCustomer, setAddSubCustomer] = useState(null);

  // System status
  const [healthStatus, setHealthStatus] = useState(null);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await api.getHealth();
      setHealthStatus(Boolean(data.success));
    } catch {
      setHealthStatus(false);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (searchPhone) params.phone = searchPhone;
      const res = await api.getCustomers(params);
      setCustomers(res.customers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchPhone]);

  useEffect(() => {
    fetchHealth();
    fetchCustomers();
  }, [fetchHealth, fetchCustomers]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCustomers();
  };

  const handleViewBill = async (subId) => {
    try {
      setError('');
      const bill = await api.getSubscriptionBill(subId);
      setSelectedBill(bill);
    } catch (err) {
      setError('Failed to fetch bill: ' + err.message);
    }
  };

  const handleResume = async (subId) => {
    try {
      setError('');
      await api.resumeSubscription(subId);
      setSuccessMessage('Subscription resumed successfully!');
      fetchCustomers();
    } catch (err) {
      setError('Failed to resume: ' + err.message);
    }
  };

  const notifySuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 5000);
    fetchCustomers();
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo-area">
          <div className="logo-badge">TT</div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>TiffinTrack</h1>
            <div className="tagline">Weekday Home-Style Tiffin Delivery & Prorated Billing</div>
          </div>
        </div>

        <div className="header-status">
          <div>
            <span
              className="status-dot"
              style={{ background: healthStatus ? '#10b981' : '#ef4444' }}
            ></span>
            {healthStatus ? 'API Connected' : 'API Connecting...'}
          </div>
        </div>
      </header>

      {/* Notifications */}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Navigation Tabs */}
      <nav className="tabs">
        <button
          className={`tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          Customer Dashboard
        </button>
        <button
          className={`tab-btn ${activeTab === 'clock' ? 'active' : ''}`}
          onClick={() => setActiveTab('clock')}
        >
          T1: Delivery Clock & Outbox
        </button>
        <button
          className={`tab-btn ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          T4: Messy Import
        </button>
      </nav>

      {/* Main Content Area */}
      {activeTab === 'customers' && (
        <div className="card">
          <div className="controls-bar">
            {/* Search */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="search-input"
                placeholder="Search by phone..."
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary">Search</button>
              {searchPhone && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSearchPhone('');
                  }}
                >
                  Clear
                </button>
              )}
            </form>

            {/* Status Filter */}
            <div className="filter-group">
              <button
                className={`filter-btn ${statusFilter === '' ? 'active' : ''}`}
                onClick={() => setStatusFilter('')}
              >
                All
              </button>
              <button
                className={`filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
                onClick={() => setStatusFilter('active')}
              >
                Active
              </button>
              <button
                className={`filter-btn ${statusFilter === 'paused' ? 'active' : ''}`}
                onClick={() => setStatusFilter('paused')}
              >
                Paused
              </button>
              <button
                className={`filter-btn ${statusFilter === 'inactive' ? 'active' : ''}`}
                onClick={() => setStatusFilter('inactive')}
              >
                Inactive
              </button>
            </div>

            {/* Add Customer Button */}
            <button className="btn btn-primary" onClick={() => setShowAddCustomer(true)}>
              + Add Customer
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              Loading customers...
            </div>
          ) : customers.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              No customers found. Click "+ Add Customer" or use "T4: Messy Import" to add subscribers.
            </div>
          ) : (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Current Plan</th>
                    <th>Cycle</th>
                    <th>Price</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((cust) => {
                    const sub = cust.activeSubscription;
                    return (
                      <tr key={cust._id}>
                        <td>
                          <strong>{cust.name}</strong>
                          {cust.email && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{cust.email}</div>}
                        </td>
                        <td>{cust.phone}</td>
                        <td>
                          <span
                            className={`badge ${
                              cust.status === 'active'
                                ? 'badge-active'
                                : cust.status === 'paused'
                                ? 'badge-paused'
                                : 'badge-inactive'
                            }`}
                          >
                            {cust.status}
                          </span>
                        </td>
                        <td>{sub ? sub.planName : <span style={{ color: '#94a3b8' }}>No Active Plan</span>}</td>
                        <td>{sub ? `${sub.cycleStart} to ${sub.cycleEnd}` : '—'}</td>
                        <td>{sub ? `₹${sub.monthlyPrice}` : '—'}</td>
                        <td>
                          <div className="actions-cell" style={{ justifyContent: 'flex-end' }}>
                            {sub && (
                              <>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleViewBill(sub._id)}
                                >
                                  Bill
                                </button>

                                {cust.status === 'paused' ? (
                                  <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleResume(sub._id)}
                                  >
                                    Resume
                                  </button>
                                ) : (
                                  <button
                                    className="btn btn-warning btn-sm"
                                    onClick={() => setPauseSub(sub)}
                                  >
                                    Pause
                                  </button>
                                )}

                                <button
                                  className="btn btn-info btn-sm"
                                  onClick={() => setTransferSub(sub)}
                                >
                                  Transfer
                                </button>
                              </>
                            )}

                            {!sub && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => setAddSubCustomer(cust)}
                              >
                                + Plan
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'clock' && <ClockTab />}
      {activeTab === 'import' && <ImportTab onRefreshData={fetchCustomers} />}

      {/* Modals */}
      {selectedBill && (
        <BillModal bill={selectedBill} onClose={() => setSelectedBill(null)} />
      )}

      {pauseSub && (
        <PauseModal
          subscription={pauseSub}
          onClose={() => setPauseSub(null)}
          onSuccess={notifySuccess}
        />
      )}

      {transferSub && (
        <TransferModal
          subscription={transferSub}
          customers={customers}
          onClose={() => setTransferSub(null)}
          onSuccess={notifySuccess}
        />
      )}

      {showAddCustomer && (
        <CreateCustomerModal
          onClose={() => setShowAddCustomer(false)}
          onSuccess={notifySuccess}
        />
      )}

      {addSubCustomer && (
        <CreateSubscriptionModal
          preselectedCustomer={addSubCustomer}
          customers={customers}
          onClose={() => setAddSubCustomer(null)}
          onSuccess={notifySuccess}
        />
      )}
    </div>
  );
}
