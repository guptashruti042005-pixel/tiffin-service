# TiffinTrack

TiffinTrack is a web application designed for home-style tiffin and lunch delivery services, supporting subscription management and prorated weekday billing.

---

## Project Structure

```text
tiffin-service/
├── .gitignore
├── README.md
├── client/                 # Frontend (React + Vite + JavaScript)
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── server/                 # Backend (Node.js + Express + JavaScript)
    ├── package.json
    └── src/
        └── index.js
```

---

## Getting Started

### 1. Backend Setup

```bash
cd server
npm install
npm run dev
```

The backend server runs on `http://localhost:5000`.

#### Health Check Endpoint
- **URL:** `http://localhost:5000/api/health`
- **Method:** `GET`
- **Response:**
  ```json
  {
    "success": true,
    "message": "TiffinTrack API is running"
  }
  ```

---

### 2. Frontend Setup

```bash
cd client
npm install
npm run dev
```

The Vite development server runs on `http://localhost:5173`.
