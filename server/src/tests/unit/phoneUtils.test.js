import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, isValidPhone } from '../../utils/phoneUtils.js';

describe('Unit Tests: phoneUtils', () => {
  test('Requirement 2: Phone normalization handles formatting, spaces, dashes, and parens', () => {
    assert.equal(normalizePhone('9876543210'), '9876543210');
    assert.equal(normalizePhone('  98765 43210  '), '9876543210');
    assert.equal(normalizePhone('987-654-3210'), '9876543210');
    assert.equal(normalizePhone('(987) 654-3210'), '9876543210');
    assert.equal(normalizePhone('(987).654.3210'), '9876543210');
    assert.equal(normalizePhone('+91 98765 43210'), '9876543210');
    assert.equal(normalizePhone('+919876543210'), '9876543210');
    assert.equal(normalizePhone('09876543210'), '9876543210');
  });

  test('Validation identifies valid and invalid phone numbers', () => {
    assert.equal(isValidPhone('9876543210'), true);
    assert.equal(isValidPhone('+91 (987) 654-3210'), true);
    assert.equal(isValidPhone('12345'), false); // Too short
    assert.equal(isValidPhone('abc9876543210'), false); // Contains letters
    assert.equal(isValidPhone(''), false);
  });
});
