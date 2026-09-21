# MAARG

**Predictive routing, risk-aware navigation, and real-time vehicle tracking.**

MAARG is a map-driven platform that combines a modern web application with a machine learning backend to deliver intelligent route planning, detour avoidance, and risk assessment — powered in part by environmental data such as rainfall.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the App](#running-the-app)
  - [Running the ML Backend](#running-the-ml-backend)
- [API Endpoints](#api-endpoints)
- [Data Ingestion](#data-ingestion)
- [Configuration](#configuration)
- [How It Works](#how-it-works)
- [Scripts & Utilities](#scripts--utilities)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **🧠 Predictive Routing** — ML-driven route suggestions that anticipate congestion and hazards.
- **🛣️ Detour Avoidance** — Automatically routes around risky or inefficient segments.
- **🗺️ Interactive Map Rendering** — Visualizes routes and live vehicle markers with dynamic scaling.
- **📉 Risk Filtering** — Hides low-risk routes (≤50%) from the list and legend for a cleaner view.
- **🚚 Live Vehicle Tracking** — Real-time location updates via dedicated API endpoints.
- **🌧️ Rainfall-Aware Risk Modeling** — Ingests IMD rainfall data to inform risk scoring.
- **🔌 Mappls Proxy Server** — Secure route drawing through a proxy layer.
- **🧪 Mock Data Fallback** — Graceful degradation when live data is unavailable.

---

## Architecture

MAARG is split into two primary layers:

```
┌─────────────────────────┐        ┌─────────────────────────┐
│        /app             │        │         /ml             │
│  (Frontend + Proxy)     │◄──────►│  (ML + Routing Backend) │
│                         │  API   │                         │
│  • Map & route UI       │        │  • Predictive routing   │
│  • Risk filtering       │        │  • Detour avoidance     │
│  • Vehicle markers      │        │  • Risk scoring         │
│  • Mappls proxy         │        │  • Rainfall ingestion   │
└─────────────────────────┘        └─────────────────────────┘
```

- The **`/app`** layer handles the user interface, map rendering, and proxying requests to external map services.
- The **`/ml`** layer handles prediction, routing logic, risk assessment, and data ingestion.

---

## Project Structure

```
MAARG/
├── .vscode/                 # Editor configuration
├── app/                     # Frontend application (map, routing UI, proxy)
├── ml/                      # ML backend (predictive routing, detour avoidance)
├── dataImpoerting.py        # IMD rainfall data ingestion script
├── fix_next_array.py        # Utility: fix Next.js array handling
├── fix_next_array2.py       # Utility: fix Next.js array handling (v2)
├── patch_ui.py              # Utility: patch UI components
├── mappleout.txt            # Mappls integration notes/output
├── APIs endpoint.txt        # API endpoint reference (incl. vehicle location updates)
├── README.md
└── .gitignore
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js (React), Map rendering (Mappls) |
| Backend / ML | Python, ML routing & prediction models |
| Data | IMD rainfall datasets, vehicle telemetry |
| Tooling | Python utility scripts, VS Code |

---

## Getting Started

### Prerequisites

- **Node.js** (v18+) and npm/yarn — for the frontend
- **Python** (3.9+) — for the ML backend and ingestion scripts
- **Mappls API credentials** — for map and routing services

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/rashikacodes/MAARG.git
   cd MAARG
   ```

2. **Install frontend dependencies**
   ```bash
   cd app
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd ../ml
   pip install -r requirements.txt
   ```

### Running the App

```bash
cd app
npm run dev
```

The frontend will be available at `http://localhost:3000` (or your configured port).

### Running the ML Backend

```bash
cd ml
python main.py
```

> Replace `main.py` with the actual entry point of your ML service.

---

## API Endpoints

A full reference lives in [`APIs endpoint.txt`](./APIs%20endpoint.txt). Key endpoints include:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/routes` | Fetch predicted routes with risk scores |
| `POST` | `/api/vehicle/location` | Update current vehicle location |
| `GET`  | `/api/vehicle/location` | Retrieve latest vehicle position |
| `POST` | `/api/predict` | Run predictive routing for a given origin/destination |
| `GET`  | `/api/proxy/mappls` | Proxy for Mappls map/route requests |

> Endpoint names are indicative — align them with your actual implementation.

---

## Data Ingestion

Rainfall data is ingested from the **India Meteorological Department (IMD)** to feed weather-aware risk modeling.

```bash
python dataImpoerting.py
```

This script pulls IMD rainfall datasets and prepares them for use in the ML risk-scoring pipeline.

---

## Configuration

Create a `.env` file in the relevant directories with the required keys:

```env
# app/.env.local
MAPPLS_API_KEY=your_mappls_api_key
ML_BACKEND_URL=http://localhost:8000

# ml/.env
IMD_DATA_PATH=./data/rainfall
MODEL_PATH=./models/routing_model.pkl
```

> Do not commit secrets. `.gitignore` should already exclude `.env` files.

---

## How It Works

1. **User requests a route** via the map interface.
2. **Frontend** sends the request to the **ML backend** through the proxy.
3. **ML backend**:
   - Scores candidate routes for risk.
   - Applies **detour avoidance** logic.
   - Incorporates **rainfall data** where relevant.
4. **Frontend** renders routes on the map:
   - Routes with risk **≤ 50% are hidden** from the list and legend.
   - Markers are **dynamically scaled** based on relevance/risk.
5. **Vehicle locations** stream in via the vehicle location API, updating markers in real time.
6. If live data is unavailable, the app falls back to **mock data** to keep the UI functional.

---

## Scripts & Utilities

| Script | Purpose |
|--------|---------|
| `dataImpoerting.py` | Ingests IMD rainfall data |
| `fix_next_array.py` | Fixes Next.js array handling issues |
| `fix_next_array2.py` | Second iteration of the array fix |
| `patch_ui.py` | Patches UI components after backend sync |

---

## Roadmap

- [ ] Improve ML model accuracy with additional environmental signals
- [ ] Add support for multi-vehicle fleet tracking
- [ ] Historical route analytics dashboard
- [ ] User-configurable risk thresholds
- [ ] Offline mode with cached routes
- [ ] Automated tests for routing and risk scoring

---

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please follow conventional commit messages (`feat:`, `fix:`, `docs:`, etc.) to match the existing history.

---

**Built with ❤️ by Team Golden Arrows**
