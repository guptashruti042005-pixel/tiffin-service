# TiffinTrack — Architecture, Reasoning & Design Decisions

This document outlines the architectural decisions, core assumptions, implementation details, testing strategy, and debugging processes for **TiffinTrack**.

---

## 1. Architectural Decisions

### 1.1 Tech Stack Selection
- **Frontend**: React 19 + Vite (JavaScript)
  - Modular component architecture (`CustomerList`, `BillModal`, `PauseModal`, `TransferModal`, `ImportTab`, `ClockTab`).
  - Centralized API service layer (`client/src/services/api.js`) to prevent scattered `fetch` calls and provide uniform error handling.
  - Clean, responsive CSS with accessible status badges and modal workflows.
- **Backend**: Node.js + Express (ES Modules)
  - Structured modular design: `controllers/`, `routes/`, `models/`, `services/`, `utils/`, `config/`.
  - Strict separation of business and calculation logic from HTTP routing.
- **Database**: MongoDB Atlas via Mongoose
  - Collections: `customers`, `subscriptions`, `pauseperiods`, `outboxes`.
  - Normalized unique phone indexing to guarantee single-source customer lookup.
  - Dedicated test database isolation on Atlas (`tiffintrack_test`) during automated test execution.

---

### 1.2 Date-Only Semantics (`YYYY-MM-DD`)
- **Problem**: Storing local JavaScript `Date` objects or raw timestamps often introduces daylight saving time (DST) and UTC timezone conversion drift, causing service days to shift by $\pm 1$ day depending on the server or client timezone.
- **Solution**: All subscription cycles, pause periods, delivery checks, and billing operations use strict ISO date-only strings (`YYYY-MM-DD`). Calendar arithmetic uses UTC year, month, and day components.

---

### 1.3 Weekday Service Days & Pro-Rated Billing Formula
- **Rule**: Lunch is delivered Monday through Friday only. Saturdays and Sundays are non-service days.
- **Billing Formula**:
  $$\text{billableAmount} = \text{round}\left(\text{monthlyPrice} \times \frac{\text{servedWeekdays}}{\text{totalWeekdays}}\right)$$
  - $\text{totalWeekdays}$: Monday–Friday count in $[\text{cycleStart}, \text{cycleEnd}]$.
  - $\text{pausedWeekdays}$: Monday–Friday count covered by pause periods.
  - $\text{servedWeekdays} = \max(0, \text{totalWeekdays} - \text{pausedWeekdays})$.
- **Overlap Protection**: All paused weekdays are collected into a unique date `Set`. If multiple pause ranges overlap or duplicate, each paused weekday is counted exactly once, preventing double-discounting.

---

### 1.4 Twist T6: Subscription Transfer Design
- **Requirement**: Transfer a subscription mid-cycle while preserving the original plan, monthly price, and cycle dates, splitting billing by served days.
- **Decision**: Rather than overwriting `subscription.customerId` (which would erase historical ownership), subscriptions track an `ownershipSegments` array:
  ```json
  [
    { "customerId": "cust_A", "startDate": "2026-09-07", "endDate": "2026-09-20" },
    { "customerId": "cust_B", "startDate": "2026-09-21", "endDate": "2026-10-02" }
  ]
  ```
- **Billing Split**: `calculateSubscriptionBill()` calculates the served weekdays and pro-rated bill for each owner based on their specific segment window, automatically attributing pauses to the active owner at the time.

---

### 1.5 Twist T1: Morning Delivery Clock & Outbox
- **Requirement**: Each morning, determine active unpaused weekday subscribers and notify them via the Notification Service.
- **Decision**:
  - `POST /api/clock` accepts a simulation date.
  - Automatically verifies if the date is Monday–Friday (weekends return 0 notifications immediately).
  - Excludes paused customers and customers without active plans on that date.
  - Decoupled `notificationService.js` handles dispatch logic.
  - Every notification event is persisted to the `outboxes` collection, enabling full auditability via `GET /outbox`.

---

### 1.6 Twist T4: Messy Customer Import
- **Requirement**: Ingest customer data with varied phone formats, mixed date formats, blanks, and duplicates, returning `{ imported, deduped, rejected, errors }`.
- **Decision**:
  - `importService.js` normalizes phone numbers by stripping whitespace, hyphens, brackets, dots, `+91`, and trunk `0`.
  - Normalizes multiple date formats (`YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, `MM/DD/YYYY`).
  - Identifies duplicate phones against existing database records and intra-batch records, attaching valid subscriptions to existing customer records without creating duplicate customers (counted as `deduped`).
  - Identifies invalid or missing fields and records explicit error reasons without discarding the batch (counted as `rejected`).

---

## 2. Assumptions

1. **Cycle Boundaries**: Subscription cycles represent calendar date ranges. Pause periods must lie within the subscription cycle.
2. **Transfer Date**: A transfer takes effect from `transferDate` at 00:00:00. The previous customer is billed through the day before `transferDate`.
3. **Weekends**: Deliveries are strictly weekday-only; pausing over a weekend excludes the weekend days from the deducted paused count.
4. **Phone Numbers**: Phone numbers are unique identifiers for customer accounts once normalized.

---

## 3. Testing & Verification

### 3.1 Test Suite Structure
Implemented 29 comprehensive automated tests using Node.js's native test runner (`node:test`, `node:assert/strict`):
- **Unit Tests** (`server/src/tests/unit/`):
  - `dateUtils.test.js`: Weekday calculation, weekend exclusion, weekend-spanning pauses, date parsing.
  - `phoneUtils.test.js`: Normalization of messy formatting, prefix handling, phone validation.
  - `billingCalculator.test.js`: Zero pause, 1 pause, multiple pauses, overlapping pauses, full-cycle pause, 2-decimal rounding, T6 transfer splits, T6 transfer with pauses.
- **Integration Tests** (`server/src/tests/integration/`):
  - `api.test.js`: Health endpoint, customer creation, 409 duplicate handling, phone lookup, subscription creation, active status derivation, pause recording, resume.
  - `t1_clock_outbox.test.js`: Weekend delivery exclusion, active weekday inclusion, paused exclusion, outbox persistence.
  - `t4_import.test.js`: Messy import with duplicates, mixed date formats, blank fields, invalid prices, exact `{ imported, deduped, rejected, errors }` counts.
  - `t6_transfer.test.js`: Mid-cycle transfer preserving plan and cycle, verifying proportional bill split.

---

## 4. Debugging Log

1. **Windows DNS SRV Resolution**:
   - *Issue*: On Windows, Node.js `dns.resolveSrv` threw `querySrv ECONNREFUSED` against Atlas SRV records because local router DNS did not support SRV lookups.
   - *Fix*: Added `dns.setServers(['8.8.8.8', '1.1.1.1'])` in `db.js` to ensure reliable resolution across Windows and cloud runtimes.
2. **Test Server Lifecycle & Port Conflicts**:
   - *Issue*: Importing `server/src/index.js` into test files caused `startServer()` to start on port 5000 during test initialization, causing `EADDRINUSE`.
   - *Fix*: Added a module entry point check (`process.argv[1]`) so `startServer()` only executes when run directly, while tests mount ephemeral ports (`app.listen(0)`).
3. **Database Test Isolation**:
   - *Issue*: Running tests against the production database could overwrite live subscriber data.
   - *Fix*: Configured `db.js` to automatically redirect to `tiffintrack_test` when `NODE_ENV === 'test'`.
