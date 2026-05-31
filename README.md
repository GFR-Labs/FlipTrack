# FlipTrack — Self-Hosted eBay Flipping Tracker

A self-hosted web app to track your eBay flipping business: inventory, listings, sales, expenses, receipts, and CPA-ready exports.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Docker Compose v2
- Git

## First-Time Setup

```bash
git clone https://github.com/gfr-labs/fliptrack-self-hosted
cd fliptrack-self-hosted
docker compose up --build -d
```

Open **http://localhost:8090** in your browser.

The first build takes ~2 minutes. Subsequent starts are instant.

## Updating

From inside the repo folder on your server:

```bash
# Pull latest and rebuild
./update.sh

# Or pull a specific tagged release
./update.sh v1.1.0
```

That's it — your `./data/` folder is a volume mount and is never touched by the update.

## Releases

| Tag | Notes |
|-----|-------|
| v1.0.0 | Initial release — dashboard, inventory, listings, sold, expenses, bulk add, receipts, CPA export |

## Features

| Page | Description |
|------|-------------|
| **Dashboard** | Net profit, gross revenue, total invested, potential profit, monthly performance chart |
| **Inventory** | Add/edit/delete items with purchase price, quantity, status, and date acquired |
| **Listings** | Track items currently listed with asking price and platform |
| **Sold** | Record completed sales — net profit calculated automatically |
| **Expenses** | Log overhead costs by category with receipt attachments |
| **Business** | CPA export — categorized CSV for any date range |
| **Bulk Add** | Add multiple items at once; status auto-set by what you fill in |

## Receipt Attachments

Click the paperclip icon on any inventory item or expense to attach JPG, PNG, PDF, or other image files. Files are stored in `./data/receipts/` and persist across updates.

## Backing Up Your Data

Everything lives in `./data/`:

```bash
cp -r ./data ./data-backup-$(date +%Y%m%d)
```

To restore: stop the container, replace `./data`, restart.

## Common Commands

```bash
docker compose up -d          # start in background
docker compose down           # stop
docker compose logs -f        # stream logs
./update.sh                   # pull latest release and rebuild
./update.sh v1.0.0            # pin to a specific version
```

## Stack

- **Backend**: Python 3.12 + FastAPI + SQLModel (SQLite)
- **Frontend**: React 18 + Vite + Tailwind CSS + Recharts
- **Container**: Single Docker image, one `docker compose up` command
