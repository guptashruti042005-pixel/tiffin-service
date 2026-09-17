# TiffinTrack

**TiffinTrack** is a full-stack weekday tiffin delivery management and pro-rated billing web application designed for home-style lunch delivery services.

---

## Architecture & Tech Stack

- **Frontend:** React 19 + Vite (JavaScript)
  - Modular dashboard with Customer Management, Pro-Rated Bill Breakdowns, Delivery Clock & Outbox (T1), and Messy Customer Import (T4).
  - Centralized API client (`client/src/services/api.js`).
- **Backend:** Node.js (v20+) + Express (ES Modules)
  - Pure JavaScript.
  - Layered architecture: Routes, Controllers, Services, Models, and Utilities.
- **Database:** MongoDB Atlas via Mongoose
  - Collections: `customers`, `subscriptions`, `pauseperiods`, `outboxes`.
  - Date-only semantics (`YYYY-MM-DD`) to avoid timezone/DST drift.
  - Isolated test database on Atlas (`tiffintrack_test`) during test runs.
- **Testing:** Node.js native test runner (`node:test`, `node:assert/strict`)
  - 29 comprehensive unit and integration tests with zero external test dependencies.

---

## Project Structure

```text
tiffin-service/
├── .gitignore
├── README.md
├── client/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.css
│       ├── App.jsx
│       ├── main.jsx
│       ├── components/
│       │   ├── BillModal.jsx
│       │   ├── ClockTab.jsx
│       │   ├── CreateCustomerModal.jsx
│       │   ├── CreateSubscriptionModal.jsx
│       │   ├── ImportTab.jsx
│       │   ├── PauseModal.jsx
│       │   └── TransferModal.jsx
│       └── services/
│           └── api.js
└── server/
    ├── package.json
    └── src/
        ├── index.js
        ├── config/
        │   └── db.js
        ├── controllers/
        │   ├── clockController.js
        │   ├── customerController.js
        │   ├── outboxController.js
        │   └── subscriptionController.js
        ├── models/
        │   ├── Customer.js
        │   ├── Outbox.js
        │   ├── PausePeriod.js
        │   └── Subscription.js
        ├── routes/
        │   ├── clockRoutes.js
        │   ├── customerRoutes.js
        │   ├── outboxRoutes.js
        │   └── subscriptionRoutes.js
        ├── services/
        │   ├── importService.js
        │   └── notificationService.js
        ├── utils/
        │   ├── billingCalculator.js
        │   ├── dateUtils.js
        │   └── phoneUtils.js
        └── tests/
            ├── integration/
            │   ├── api.test.js
            │   ├── t1_clock_outbox.test.js
            │   ├── t4_import.test.js
            │   └── t6_transfer.test.js
            └── unit/
                ├── billingCalculator.test.js
                ├── dateUtils.test.js
                └── phoneUtils.test.js
```

---

## Environment Variables

Configure `server/.env` (ignored by Git):

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/<database>?retryWrites=true&w=majority
```

> **Security Note:** `server/.env` is strictly ignored by `.gitignore` and must never be committed.

---

## Setup & Running the Application

### 1. Install Dependencies

```bash
# In server
cd server
npm install

# In client
cd ../client
npm install
```

### 2. Start Backend Server

```bash
cd server
npm run dev
# Server starts at http://localhost:5000
```

### 3. Start Frontend

```bash
cd client
npm run dev
# Frontend runs at http://localhost:5173
```

---

## Running Automated Tests

Run the complete 29-test automated test suite:

```bash
cd server
npm test
```

Or run unit / integration tests separately:

```bash
npm run test:unit
npm run test:integration
```

---

## Core Business & Billing Rules

### Weekdays Only
- Only **Monday through Friday** are deliverable service days.
- **Saturdays and Sundays** are excluded from delivery and pro-rated billing.

### Billing Formula
For any subscription billing cycle:
$$\text{amountDue} = \text{round}\left(\text{monthlyPrice} \times \frac{\text{servedWeekdays}}{\text{totalWeekdays}}\right)$$

Where:
- $\text{totalWeekdays}$ = Count of Monday-Friday dates in $[\text{cycleStart}, \text{cycleEnd}]$.
- $\text{pausedWeekdays}$ = Count of unique weekdays falling within any recorded pause period.
- $\text{servedWeekdays} = \max(0, \text{totalWeekdays} - \text{pausedWeekdays})$.
- Standard rounding to 2 decimal places.
- Full-cycle pause evaluates to $\text{amountDue} = 0$.

### Pause & Resume Semantics
- Pause ranges are inclusive $[\text{startDate}, \text{endDate}]$.
- Paused weekdays are collected into a unique date `Set` to prevent double-discounting overlapping pauses.
- Resuming a subscription shortens active ongoing pauses and sets subscription status back to `active`.

### Derived Customer Status
Customer status on any date is derived dynamically:
- **`active`**: An active subscription covers the date and the date is not inside any pause period.
- **`paused`**: An active subscription covers the date but the date falls inside a pause period.
- **`inactive`**: No active subscription covering the date.

---

## Assessment Twists

### T1 — Morning Delivery Clock & Outbox (`POST /api/clock`, `GET /outbox`)
- Dispatches delivery notifications each morning for active, unpaused weekday subscribers.
- Weekends (Sat/Sun) automatically skip delivery with 0 notified.
- Dispatched events are recorded to the `outboxes` collection for auditing via `GET /outbox` or `GET /api/outbox`.

### T6 — Subscription Transfer (`POST /api/subscriptions/:id/transfer`)
- Allows transferring a subscription mid-cycle to a new customer.
- **Preserves** the original plan name, monthly price, and billing cycle start/end dates.
- Uses `ownershipSegments` to track who owned the subscription during each segment:
  - Previous owner is billed only for weekdays served before the transfer date.
  - New owner is billed only for weekdays served from the transfer date onward.
  - Paused weekdays are deducted from the respective owner's segment.

### T4 — Messy Customer Import (`POST /api/customers/import`)
- Batch imports messy customer data with deduplication and validation.
- Normalizes phone numbers (removes spaces, dashes, parentheses, `+91`, leading `0`).
- Parses multiple date formats (`YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, ISO).
- Deduplicates repeated phones (attaches subscriptions without duplicating customers).
- Rejects malformed records with row number and reason.
- Returns report:
  ```json
  {
    "imported": 2,
    "deduped": 1,
    "rejected": 1,
    "errors": [
      { "row": 4, "reason": "Missing required field: name" }
    ]
  }
  ```

---

## REST API Documentation

### Health Check
- `GET /api/health` -> `{ "success": true, "message": "TiffinTrack API is running" }`

### Customers
- `POST /api/customers` -> Create customer `{ name, phone, email?, address? }`
- `GET /api/customers` -> List customers (supports `?status=active|paused|inactive&phone=...&page=1&limit=50`)
- `GET /api/customers/:phone` -> Get customer by normalized phone with active subscription and status
- `POST /api/customers/import` -> T4 messy import `{ imported, deduped, rejected, errors }`

### Subscriptions
- `POST /api/subscriptions` -> Create subscription `{ customerId, planName, monthlyPrice, cycleStart, cycleEnd }`
- `GET /api/subscriptions/:id` -> Get subscription by ID with pause history and customer details
- `POST /api/subscriptions/:id/pause` -> Record pause period `{ startDate, endDate, reason? }`
- `POST /api/subscriptions/:id/resume` -> Resume subscription
- `GET /api/subscriptions/:id/bill` -> Calculate pro-rated bill with weekday breakdown and T6 transfer split
- `POST /api/subscriptions/:id/transfer` -> T6 Transfer subscription `{ newCustomerId, transferDate }`

### Notifications (T1)
- `POST /api/clock` -> Trigger morning delivery check `{ date: "YYYY-MM-DD" }`
- `GET /outbox` -> View notification audit log (also available at `GET /api/outbox`)
