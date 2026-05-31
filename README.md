# FlipTrack — Self-Hosted eBay Flipping Tracker

A self-hosted web app to track your eBay flipping business: inventory, listings, sales, expenses, and CPA-ready exports.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Docker Compose (v2)

## Quick Start

```bash
git clone https://github.com/gfr-labs/fliptrack-self-hosted
cd fliptrack-self-hosted
docker compose up --build
```

Open **http://localhost:8080** in your browser.

The first build takes ~2 minutes (downloads npm packages and Python deps). Subsequent starts are instant.

## Features

| Page | Description |
|------|-------------|
| **Dashboard** | Net profit, gross revenue, total invested, potential profit, monthly performance chart |
| **Inventory** | Add/edit/delete items with purchase price, quantity, status, and date acquired |
| **Listings** | Track items currently listed with asking price and platform |
| **Sold** | Record completed sales — net profit calculated automatically (sale − fees − shipping − cost) |
| **Expenses** | Log overhead costs by category (shipping supplies, eBay fees, mileage, etc.) |
| **Business** | CPA export: generate categorized CSV summary for any date range |

## Backing Up Your Data

All data lives in the `./data/` folder as a single SQLite file:

```bash
cp -r ./data ./data-backup-$(date +%Y%m%d)
```

To restore, stop the container, replace the `./data` folder, and restart.

## Stopping / Restarting

```bash
docker compose down      # stop
docker compose up -d     # start in background
```

## Stack

- **Backend**: Python 3.12 + FastAPI + SQLModel (SQLite)
- **Frontend**: React 18 + Vite + Tailwind CSS + Recharts
- **Container**: Single Docker image, one `docker compose up` command
