import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../../index.js';
import connectDB from '../../config/db.js';
import Customer from '../../models/Customer.js';
import Subscription from '../../models/Subscription.js';

describe('Integration Tests: T4 Messy Customer Import', () => {
  let server;
  let baseUrl;

  before(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
    await Customer.deleteMany({});
    await Subscription.deleteMany({});

    // Pre-seed an existing customer for deduplication testing
    await Customer.create({
      name: 'Existing Customer',
      phone: '9988776655'
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

  test('Requirement 25-29: Import handles valid, messy dates, duplicates, blanks, and invalid rows', async () => {
    const importPayload = [
      // Row 1: Valid new customer with standard ISO dates -> imported
      {
        name: 'Amit Patel',
        phone: '9870011223',
        plan: 'Standard Lunch',
        monthlyPrice: 2000,
        cycleStart: '2026-09-01',
        cycleEnd: '2026-09-30'
      },
      // Row 2: Valid new customer with mixed date formats (DD-MM-YYYY) -> imported
      {
        name: 'Sunita Rao',
        phone: '+91 (987) 002-2334',
        plan: 'Deluxe Veg',
        monthlyPrice: 2500,
        cycleStart: '01-09-2026',
        cycleEnd: '30-09-2026'
      },
      // Row 3: Duplicate phone (matches existing DB customer) -> deduped
      {
        name: 'Existing Customer New Plan',
        phone: '(998) 877-6655',
        plan: 'Evening Snack',
        monthlyPrice: 1200,
        cycleStart: '2026-09-01',
        cycleEnd: '2026-09-30'
      },
      // Row 4: Duplicate phone in same batch as Row 1 -> deduped
      {
        name: 'Amit Patel Duplicate',
        phone: '987-001-1223'
      },
      // Row 5: Blank name -> rejected
      {
        name: '',
        phone: '9870033445'
      },
      // Row 6: Invalid phone -> rejected
      {
        name: 'Invalid Phone User',
        phone: 'invalid_number'
      },
      // Row 7: Invalid date format -> rejected
      {
        name: 'Bad Dates User',
        phone: '9870044556',
        monthlyPrice: 2000,
        cycleStart: 'not-a-date',
        cycleEnd: '2026-09-30'
      },
      // Row 8: Non-positive price -> rejected
      {
        name: 'Zero Price User',
        phone: '9870055667',
        monthlyPrice: -50,
        cycleStart: '2026-09-01',
        cycleEnd: '2026-09-30'
      }
    ];

    const res = await fetch(`${baseUrl}/api/customers/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(importPayload)
    });

    assert.equal(res.status, 200);
    const report = await res.json();

    // 2 imported (Row 1, Row 2)
    assert.equal(report.imported, 2);
    // 2 deduped (Row 3 existing DB, Row 4 batch duplicate)
    assert.equal(report.deduped, 2);
    // 4 rejected (Row 5 blank name, Row 6 invalid phone, Row 7 bad date, Row 8 non-positive price)
    assert.equal(report.rejected, 4);

    // Errors report should detail rejected rows
    assert.equal(report.errors.length, 4);
    assert.equal(report.errors[0].row, 5);
    assert.match(report.errors[0].reason, /name/i);

    assert.equal(report.errors[1].row, 6);
    assert.match(report.errors[1].reason, /phone/i);

    assert.equal(report.errors[2].row, 7);
    assert.match(report.errors[2].reason, /date/i);

    assert.equal(report.errors[3].row, 8);
    assert.match(report.errors[3].reason, /price/i);
  });
});
