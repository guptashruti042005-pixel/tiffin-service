import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../../index.js';
import connectDB from '../../config/db.js';
import Customer from '../../models/Customer.js';
import Subscription from '../../models/Subscription.js';
import PausePeriod from '../../models/PausePeriod.js';

describe('Integration Tests: Customer & Subscription APIs', () => {
  let server;
  let baseUrl;

  before(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
    // Clean test database
    await Customer.deleteMany({});
    await Subscription.deleteMany({});
    await PausePeriod.deleteMany({});

    // Start server on ephemeral port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((r) => server.close(r));
    await mongoose.connection.close();
  });

  test('GET /api/health returns success status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.message, 'TiffinTrack API is running');
  });

  let createdCustomerId;
  test('Requirement 1: Customer creation via POST /api/customers', async () => {
    const res = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rahul Sharma',
        phone: '+91 (987) 654-3210',
        email: 'rahul@example.com',
        address: 'B-102, Green Park'
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.name, 'Rahul Sharma');
    // Normalized phone
    assert.equal(data.phone, '9876543210');
    createdCustomerId = data._id;
  });

  test('Requirement 3: Duplicate phone handling returns 409 Conflict', async () => {
    const res = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rahul Duplicate',
        phone: '987-654-3210' // Same phone with different formatting
      })
    });

    assert.equal(res.status, 409);
    const data = await res.json();
    assert.match(data.error, /already exists/i);
  });

  test('Requirement 16: Phone lookup via GET /api/customers/:phone', async () => {
    // Lookup with formatted phone
    const res = await fetch(`${baseUrl}/api/customers/(987) 654-3210`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.name, 'Rahul Sharma');
    assert.equal(data.phone, '9876543210');
  });

  let createdSubId;
  test('Requirement 4: Subscription creation via POST /api/subscriptions', async () => {
    const res = await fetch(`${baseUrl}/api/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: createdCustomerId,
        planName: 'North Indian Thali',
        monthlyPrice: 2400,
        cycleStart: '2026-09-01',
        cycleEnd: '2026-09-30'
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.customerId, createdCustomerId);
    assert.equal(data.monthlyPrice, 2400);
    assert.equal(data.status, 'active');
    createdSubId = data._id;
  });

  test('Requirement 14: Customer active status derived from subscription', async () => {
    const res = await fetch(`${baseUrl}/api/customers/9876543210`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'active');
  });

  test('Requirement 15: Paused status after recording a pause period', async () => {
    // Pause covering current date (e.g. 2026-09-01 to 2026-09-30)
    const pauseRes = await fetch(`${baseUrl}/api/subscriptions/${createdSubId}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        reason: 'Travel vacation'
      })
    });

    assert.equal(pauseRes.status, 201);

    // Verify customer status is now paused
    const custRes = await fetch(`${baseUrl}/api/customers/9876543210`);
    assert.equal(custRes.status, 200);
    const custData = await custRes.json();
    assert.equal(custData.status, 'paused');
  });

  test('Resume subscription restores active status', async () => {
    const resumeRes = await fetch(`${baseUrl}/api/subscriptions/${createdSubId}/resume`, {
      method: 'POST'
    });

    assert.equal(resumeRes.status, 200);
    const sub = await Subscription.findById(createdSubId);
    assert.equal(sub.status, 'active');
  });
});
