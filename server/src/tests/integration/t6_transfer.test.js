import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../../index.js';
import connectDB from '../../config/db.js';
import Customer from '../../models/Customer.js';
import Subscription from '../../models/Subscription.js';
import PausePeriod from '../../models/PausePeriod.js';

describe('Integration Tests: T6 Subscription Transfer API', () => {
  let server;
  let baseUrl;
  let custA;
  let custB;

  before(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
    await Customer.deleteMany({});
    await Subscription.deleteMany({});
    await PausePeriod.deleteMany({});

    custA = await Customer.create({ name: 'Vikram Joshi', phone: '9711100001' });
    custB = await Customer.create({ name: 'Neha Gupta', phone: '9711100002' });

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

  test('Requirement 21-24: Transfer mid-cycle preserves plan, cycle, and splits billing correctly', async () => {
    // Cycle: Mon Sep 7 to Fri Oct 2, 2026 (20 weekdays), monthlyPrice = 2000
    const sub = await Subscription.create({
      customerId: custA._id,
      planName: 'Premium Executive Box',
      monthlyPrice: 2000,
      cycleStart: '2026-09-07',
      cycleEnd: '2026-10-02',
      status: 'active',
      ownershipSegments: [
        { customerId: custA._id, startDate: '2026-09-07', endDate: '2026-10-02' }
      ]
    });

    // Add a pause in week 1 for CustA: Wed Sep 9 (1 day)
    await PausePeriod.create({
      subscriptionId: sub._id,
      startDate: '2026-09-09',
      endDate: '2026-09-09',
      reason: 'Travel'
    });

    // Transfer to CustB effective Monday Sep 21, 2026 (exactly mid-cycle)
    const transferRes = await fetch(`${baseUrl}/api/subscriptions/${sub._id}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newCustomerId: custB._id,
        transferDate: '2026-09-21'
      })
    });

    assert.equal(transferRes.status, 200);
    const transferData = await transferRes.json();
    assert.equal(transferData.subscription.customerId, String(custB._id));
    // Verify segments
    assert.equal(transferData.subscription.ownershipSegments.length, 2);
    // Old customer segment: Sep 7 to Sep 20
    assert.equal(transferData.subscription.ownershipSegments[0].customerId, String(custA._id));
    assert.equal(transferData.subscription.ownershipSegments[0].startDate, '2026-09-07');
    assert.equal(transferData.subscription.ownershipSegments[0].endDate, '2026-09-20');
    // New customer segment: Sep 21 to Oct 02
    assert.equal(transferData.subscription.ownershipSegments[1].customerId, String(custB._id));
    assert.equal(transferData.subscription.ownershipSegments[1].startDate, '2026-09-21');
    assert.equal(transferData.subscription.ownershipSegments[1].endDate, '2026-10-02');

    // Add a pause in week 4 for CustB: Fri Oct 2 (1 day)
    await PausePeriod.create({
      subscriptionId: sub._id,
      startDate: '2026-10-02',
      endDate: '2026-10-02',
      reason: 'Holiday'
    });

    // Verify Bill Breakdown
    const billRes = await fetch(`${baseUrl}/api/subscriptions/${sub._id}/bill`);
    assert.equal(billRes.status, 200);
    const bill = await billRes.json();

    // Preserved plan and cycle
    assert.equal(bill.plan, 'Premium Executive Box');
    assert.equal(bill.cycleStart, '2026-09-07');
    assert.equal(bill.cycleEnd, '2026-10-02');
    assert.equal(bill.monthlyPrice, 2000);

    // Total weekdays = 20, paused weekdays = 2 (Sep 9, Oct 2), served weekdays = 18
    assert.equal(bill.totalWeekdays, 20);
    assert.equal(bill.pausedWeekdays, 2);
    assert.equal(bill.servedWeekdays, 18);
    // Total amountDue = 2000 * 18 / 20 = 1800
    assert.equal(bill.amountDue, 1800);

    // Check segments:
    // Cust A: 10 weekdays total - 1 pause = 9 served -> 2000 * 9 / 20 = 900
    // Cust B: 10 weekdays total - 1 pause = 9 served -> 2000 * 9 / 20 = 900
    assert.equal(bill.segments.length, 2);
    assert.equal(bill.segments[0].servedWeekdays, 9);
    assert.equal(bill.segments[0].amountDue, 900);
    assert.equal(bill.segments[1].servedWeekdays, 9);
    assert.equal(bill.segments[1].amountDue, 900);
  });
});
