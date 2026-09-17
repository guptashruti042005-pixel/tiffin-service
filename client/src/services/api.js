/**
 * Centralized API Client for TiffinTrack Frontend
 */

const API_BASE = ''; // Uses Vite proxy in development; can be overridden via VITE_API_URL

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Health
  getHealth: () => request('/api/health'),

  // Customers
  getCustomers: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.phone) query.append('phone', params.phone);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/api/customers${qs}`);
  },

  getCustomerByPhone: (phone) => request(`/api/customers/${encodeURIComponent(phone)}`),

  createCustomer: (data) =>
    request('/api/customers', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Subscriptions
  createSubscription: (data) =>
    request('/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getSubscription: (id) => request(`/api/subscriptions/${id}`),

  pauseSubscription: (id, data) =>
    request(`/api/subscriptions/${id}/pause`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  resumeSubscription: (id) =>
    request(`/api/subscriptions/${id}/resume`, {
      method: 'POST'
    }),

  getSubscriptionBill: (id) => request(`/api/subscriptions/${id}/bill`),

  // T6 Subscription Transfer
  transferSubscription: (id, data) =>
    request(`/api/subscriptions/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // T4 Messy Customer Import
  importCustomers: (records) =>
    request('/api/customers/import', {
      method: 'POST',
      body: JSON.stringify(records)
    }),

  // T1 Morning Delivery Notifications & Outbox
  triggerClock: (data) =>
    request('/api/clock', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getOutbox: (params = {}) => {
    const query = new URLSearchParams();
    if (params.date) query.append('date', params.date);
    if (params.customerId) query.append('customerId', params.customerId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/outbox${qs}`);
  }
};

export default api;
