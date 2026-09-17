import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSubscriptionBill } from '../../utils/billingCalculator.js';

describe('Unit Tests: billingCalculator', () => {
  // Setup standard 4-week cycle: Mon 2026-09-07 to Fri 2026-10-02 (20 weekdays)
  // Week 1: Sep 7 - 11 (5)
  // Week 2: Sep 14 - 18 (5)
  // Week 3: Sep 21 - 25 (5)
  // Week 4: Sep 28 - Oct 2 (5)
  // Total Weekdays = 20
  const standardSub = {
    planName: 'Deluxe Tiffin',
    monthlyPrice: 2000,
    cycleStart: '2026-09-07',
    cycleEnd: '2026-10-02',
    ownershipSegments: []
  };

  test('Requirement 7: No pause billing (Full monthly price billed)', () => {
    const bill = calculateSubscriptionBill(standardSub, []);
    assert.equal(bill.totalWeekdays, 20);
    assert.equal(bill.pausedWeekdays, 0);
    assert.equal(bill.servedWeekdays, 20);
    assert.equal(bill.amountDue, 2000);
  });

  test('Requirement 8: One paused weekday (1 day deducted from total weekdays)', () => {
    // Pause Wednesday 2026-09-16
    const pauses = [{ startDate: '2026-09-16', endDate: '2026-09-16' }];
    const bill = calculateSubscriptionBill(standardSub, pauses);
    assert.equal(bill.totalWeekdays, 20);
    assert.equal(bill.pausedWeekdays, 1);
    assert.equal(bill.servedWeekdays, 19);
    // 2000 * 19 / 20 = 1900
    assert.equal(bill.amountDue, 1900);
  });

  test('Requirement 9: Multiple paused weekdays (Deducts all paused weekdays)', () => {
    // Pause 3 weekdays: Tue Sep 15, Wed Sep 16, Thu Sep 17
    const pauses = [{ startDate: '2026-09-15', endDate: '2026-09-17' }];
    const bill = calculateSubscriptionBill(standardSub, pauses);
    assert.equal(bill.totalWeekdays, 20);
    assert.equal(bill.pausedWeekdays, 3);
    assert.equal(bill.servedWeekdays, 17);
    // 2000 * 17 / 20 = 1700
    assert.equal(bill.amountDue, 1700);
  });

  test('Requirement 10: Pause spanning a weekend (Excludes Saturday and Sunday)', () => {
    // Pause from Friday 2026-09-18 to Tuesday 2026-09-22
    // Covers: Fri (18), Mon (21), Tue (22) = 3 weekdays (Sat 19 and Sun 20 are NOT charged/paused weekdays)
    const pauses = [{ startDate: '2026-09-18', endDate: '2026-09-22' }];
    const bill = calculateSubscriptionBill(standardSub, pauses);
    assert.equal(bill.totalWeekdays, 20);
    assert.equal(bill.pausedWeekdays, 3);
    assert.equal(bill.servedWeekdays, 17);
    assert.equal(bill.amountDue, 1700);
  });

  test('Requirement 11: Overlapping pause handling (Does not double-discount overlapping days)', () => {
    // Pause A: Sep 14 to Sep 16 (Mon, Tue, Wed = 3 days)
    // Pause B: Sep 15 to Sep 18 (Tue, Wed, Thu, Fri = 4 days)
    // Union = Sep 14, 15, 16, 17, 18 = 5 unique weekdays
    const pauses = [
      { startDate: '2026-09-14', endDate: '2026-09-16' },
      { startDate: '2026-09-15', endDate: '2026-09-18' }
    ];
    const bill = calculateSubscriptionBill(standardSub, pauses);
    assert.equal(bill.totalWeekdays, 20);
    assert.equal(bill.pausedWeekdays, 5);
    assert.equal(bill.servedWeekdays, 15);
    // 2000 * 15 / 20 = 1500
    assert.equal(bill.amountDue, 1500);
  });

  test('Requirement 12: Full-cycle pause (Zero amount due when entire cycle paused)', () => {
    const pauses = [{ startDate: '2026-09-07', endDate: '2026-10-02' }];
    const bill = calculateSubscriptionBill(standardSub, pauses);
    assert.equal(bill.totalWeekdays, 20);
    assert.equal(bill.pausedWeekdays, 20);
    assert.equal(bill.servedWeekdays, 0);
    assert.equal(bill.amountDue, 0);
  });

  test('Requirement 13: Bill rounding (Rounds consistently to 2 decimal places)', () => {
    // 21 weekdays, monthlyPrice = 2500, served = 13 weekdays
    // 2500 * 13 / 21 = 1547.619047... -> 1547.62
    const sub = {
      planName: 'Veg Thali',
      monthlyPrice: 2500,
      cycleStart: '2026-09-01', // Tue
      cycleEnd: '2026-09-29'    // 21 weekdays
    };
    // Pause 8 weekdays -> 13 served
    const pauses = [
      { startDate: '2026-09-01', endDate: '2026-09-10' } // Sep 1,2,3,4, 7,8,9,10 = 8 weekdays
    ];
    const bill = calculateSubscriptionBill(sub, pauses);
    assert.equal(bill.totalWeekdays, 21);
    assert.equal(bill.servedWeekdays, 13);
    assert.equal(bill.amountDue, 1547.62);
  });

  test('Requirement 21, 22, 23: T6 Subscription Transfer preserves plan, cycle, and splits billing', () => {
    // Total 20 weekdays. CustA served first 10 days, CustB served next 10 days
    // Sep 7 - Sep 18 (10 weekdays) -> CustA
    // Sep 21 - Oct 02 (10 weekdays) -> CustB
    const transferredSub = {
      planName: 'Deluxe Tiffin',
      monthlyPrice: 2000,
      cycleStart: '2026-09-07',
      cycleEnd: '2026-10-02',
      ownershipSegments: [
        { customerId: 'cust_A', startDate: '2026-09-07', endDate: '2026-09-18' },
        { customerId: 'cust_B', startDate: '2026-09-21', endDate: '2026-10-02' }
      ]
    };

    const bill = calculateSubscriptionBill(transferredSub, []);
    assert.equal(bill.cycleStart, '2026-09-07');
    assert.equal(bill.cycleEnd, '2026-10-02');
    assert.equal(bill.monthlyPrice, 2000);
    assert.equal(bill.totalWeekdays, 20);
    assert.equal(bill.servedWeekdays, 20);
    assert.equal(bill.amountDue, 2000);

    assert.equal(bill.segmentsBreakdown.length, 2);
    // Cust A
    assert.equal(bill.segmentsBreakdown[0].customerId, 'cust_A');
    assert.equal(bill.segmentsBreakdown[0].servedWeekdays, 10);
    assert.equal(bill.segmentsBreakdown[0].amountDue, 1000);

    // Cust B
    assert.equal(bill.segmentsBreakdown[1].customerId, 'cust_B');
    assert.equal(bill.segmentsBreakdown[1].servedWeekdays, 10);
    assert.equal(bill.segmentsBreakdown[1].amountDue, 1000);

    // Sum of split amounts equals total
    assert.equal(
      bill.segmentsBreakdown[0].amountDue + bill.segmentsBreakdown[1].amountDue,
      bill.amountDue
    );
  });

  test('Requirement 24: T6 Transfer with paused days excluded for the relevant owner', () => {
    // CustA has Sep 7 - Sep 18 (10 days)
    // CustB has Sep 21 - Oct 02 (10 days)
    // Pause during CustA period: Sep 9 - Sep 10 (2 days)
    // Pause during CustB period: Sep 23 (1 day)
    const transferredSub = {
      planName: 'Deluxe Tiffin',
      monthlyPrice: 2000,
      cycleStart: '2026-09-07',
      cycleEnd: '2026-10-02',
      ownershipSegments: [
        { customerId: 'cust_A', startDate: '2026-09-07', endDate: '2026-09-18' },
        { customerId: 'cust_B', startDate: '2026-09-21', endDate: '2026-10-02' }
      ]
    };

    const pauses = [
      { startDate: '2026-09-09', endDate: '2026-09-10' }, // 2 weekdays in CustA
      { startDate: '2026-09-23', endDate: '2026-09-23' }  // 1 weekday in CustB
    ];

    const bill = calculateSubscriptionBill(transferredSub, pauses);
    assert.equal(bill.totalWeekdays, 20);
    assert.equal(bill.pausedWeekdays, 3);
    assert.equal(bill.servedWeekdays, 17);
    assert.equal(bill.amountDue, 1700);

    // CustA served 10 - 2 = 8 weekdays -> 2000 * 8 / 20 = 800
    assert.equal(bill.segmentsBreakdown[0].servedWeekdays, 8);
    assert.equal(bill.segmentsBreakdown[0].amountDue, 800);

    // CustB served 10 - 1 = 9 weekdays -> 2000 * 9 / 20 = 900
    assert.equal(bill.segmentsBreakdown[1].servedWeekdays, 9);
    assert.equal(bill.segmentsBreakdown[1].amountDue, 900);

    assert.equal(
      bill.segmentsBreakdown[0].amountDue + bill.segmentsBreakdown[1].amountDue,
      1700
    );
  });
});
