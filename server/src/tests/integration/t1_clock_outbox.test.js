import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../../index.js';
import connectDB from '../../config/db.js';
import Customer from '../../models/Customer.js';
import Subscription from '../../models/Subscription.js';
import PausePeriod from '../../models/PausePeriod.js';
import Outbox from '../../models/Outbox.js';

describe('Integration Tests: T1 Clock and Outbox Integration', () => {
  let server;
  let baseUrl;
  let activeCustomer;
  let pausedCustomer;

  before(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
    await Customer.deleteMany({});
    await Subscription.deleteMany({});
    await PausePeriod.deleteMany({});
    await Outbox.deleteMany({});

    // Setup active customer
    activeCustomer = await Customer.create({
      name: 'Pooja Mehta',
      phone: '9811122233'
    });
    await Subscription.create({
      customerId: activeCustomer._id,
      planName: 'South Indian Combo',
      monthlyPrice: 2200,
      cycleStart: '2026-09-01',
      cycleEnd: '2026-09-30',
      status: 'active'
    });

    // Setup paused customer
    pausedCustomer = await Customer.create({
      name: 'Anil Verma',
      phone: '9844455566'
    });
    const pausedSub = await Subscription.create({
      customerId: pausedCustomer._id,
      planName: 'North Indian Thali',
      monthlyPrice: 2500,
      cycleStart: '2026-09-01',
      cycleEnd: '2026-09-30',
      status: 'paused'
    });
    // Pause covers Wednesday 2026-09-16
    await PausePeriod.create({
      subscriptionId: pausedSub._id,
      startDate: '2026-09-15',
      endDate: '2026-09-18',
      reason: 'Festival break'
    });

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

  test('Requirement 17: T1 /clock excludes weekends (Saturday/Sunday no delivery)', async () => {
    // 2026-09-19 is Saturday
    const res = await fetch(`${baseUrl}/api/clock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-09-19' })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.isWeekday, false);
    assert.equal(data.notifiedCount, 0);
    assert.match(data.message, /weekend/i);
  });

  test('Requirement 18 & 19: T1 /clock includes active customers and excludes paused customers on a weekday', async () => {
    // 2026-09-16 is Wednesday (Pooja is active, Anil is paused on 15-18)
    const res = await fetch(`${baseUrl}/api/clock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-09-16' })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.isWeekday, true);
    assert.equal(data.notifiedCount, 1);

    // Only active customer notified
    assert.equal(data.notifications[0].customerName, 'Pooja Mehta');
    assert.equal(data.notifications[0].phone, '9811122233');
  });

  test('Requirement 20: /outbox contains generated notifications for audit', async () => {
    const res = await fetch(`${baseUrl}/outbox?date=2026-09-16`);
    assert.equal(res.status, 200);
    const events = await res.json();
    assert.equal(events.length, 1);
    assert.equal(events[0].date, '2026-09-16');
    assert.equal(events[0].type, 'DELIVERY_DUE');
    assert.equal(events[0].status, 'SENT');
    assert.equal(events[0].payload.customerName, 'Pooja Mehta');
    assert.ok(events[0].timestamp);
  });
});
