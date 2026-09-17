import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  toDateString,
  parseMessyDate,
  isWeekday,
  countWeekdays,
  getWeekdaysInRange,
  addDays
} from '../../utils/dateUtils.js';

describe('Unit Tests: dateUtils', () => {
  test('Requirement 5: Weekday calculation (Monday-Friday)', () => {
    // 2026-09-14 is Monday, 2026-09-18 is Friday (5 weekdays)
    assert.equal(isWeekday('2026-09-14'), true);
    assert.equal(isWeekday('2026-09-15'), true);
    assert.equal(isWeekday('2026-09-16'), true);
    assert.equal(isWeekday('2026-09-17'), true);
    assert.equal(isWeekday('2026-09-18'), true);

    const weekdays = getWeekdaysInRange('2026-09-14', '2026-09-18');
    assert.equal(weekdays.length, 5);
    assert.equal(countWeekdays('2026-09-14', '2026-09-18'), 5);
  });

  test('Requirement 6: Weekend exclusion (Saturday and Sunday are never weekdays)', () => {
    // 2026-09-19 is Saturday, 2026-09-20 is Sunday
    assert.equal(isWeekday('2026-09-19'), false);
    assert.equal(isWeekday('2026-09-20'), false);

    // Range spanning from Friday to Monday (4 calendar days, only 2 weekdays: Fri and Mon)
    const range = getWeekdaysInRange('2026-09-18', '2026-09-21');
    assert.deepEqual(range, ['2026-09-18', '2026-09-21']);
    assert.equal(countWeekdays('2026-09-18', '2026-09-21'), 2);
  });

  test('Requirement 10: Pause spanning a weekend (excludes weekend days from count)', () => {
    // Range from Friday (2026-09-18) to Tuesday (2026-09-22) = 5 calendar days, 3 weekdays
    const weekdays = getWeekdaysInRange('2026-09-18', '2026-09-22');
    assert.deepEqual(weekdays, ['2026-09-18', '2026-09-21', '2026-09-22']);
    assert.equal(countWeekdays('2026-09-18', '2026-09-22'), 3);
  });

  test('Date parsing supports messy formats (ISO, DD-MM-YYYY, DD/MM/YYYY)', () => {
    assert.equal(parseMessyDate('2026-09-15'), '2026-09-15');
    assert.equal(parseMessyDate('15-09-2026'), '2026-09-15');
    assert.equal(parseMessyDate('15/09/2026'), '2026-09-15');
    assert.equal(parseMessyDate('2026/09/15'), '2026-09-15');
    assert.equal(parseMessyDate('invalid'), null);
  });

  test('addDays calculates correct dates across month boundaries', () => {
    assert.equal(addDays('2026-09-30', 1), '2026-10-01');
    assert.equal(addDays('2026-10-01', -1), '2026-09-30');
  });
});
