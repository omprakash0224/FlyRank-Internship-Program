# Scraper Workshop — Week Six

A professional web-scraping pipeline built for the FlyRank Internship Program.

## What it does

Crawls **[books.toscrape.com](https://books.toscrape.com)** — a purpose-built
scraping sandbox — and runs every page through a five-stage pipeline:

```
fetch → parse → extract → clean → structure → save
```

The output is a clean, typed dataset of ~1 000 books saved as both
**`data/books.json`** and **`data/books.csv`**.

---

## Ethical scraping practices

| Practice | How it's implemented |
|---|---|
| **robots.txt** | Parsed with Python's `urllib.robotparser` before any request is made. The script exits if the crawler is disallowed. |
| **User-Agent** | Every request identifies the bot: `ScraperWorkshopBot/1.0 (FlyRank Internship Practice; educational use only)` |
| **Rate limiting** | `time.sleep(1.5)` between every page request (configurable via `--delay`) |
| **Timeouts** | All requests have a 10-second timeout to avoid hanging connections |

---

## Project structure

```
week-six/
├── scraper.py          # Main pipeline script
├── requirements.txt    # Python dependencies
├── README.md           # This file
└── data/               # Created on first run
    ├── books.json
    └── books.csv
```

---

## Setup

```bash
# 1. Create and activate a virtual environment (recommended)
python -m venv .venv
.venv\Scripts\activate       # Windows
# source .venv/bin/activate  # macOS / Linux

# 2. Install dependencies
pip install -r requirements.txt
```

---

## Usage

```bash
# Scrape all ~50 pages (≈ 1 000 books)
python scraper.py

# Scrape only the first 3 pages (quick test)
python scraper.py --pages 3

# Custom delay between requests (default 1.5 s)
python scraper.py --delay 2.0

# Custom output directory
python scraper.py --out-dir output

# Combine flags
python scraper.py --pages 5 --delay 1.0 --out-dir results
```

---

## Pipeline stages

### Stage 0 — robots.txt check
Fetches `https://books.toscrape.com/robots.txt` via `urllib.robotparser.RobotFileParser`.
If the site disallows the bot, the script exits immediately with an error message.

### Stage 1 — Fetch
`requests.Session.get()` with a persistent `User-Agent` header and a 10-second timeout.
Errors are caught and logged; a failed page is skipped rather than crashing the run.

### Stage 2 — Parse
`BeautifulSoup` with the `lxml` back-end parses the raw HTML into a navigable tree.

### Stage 3 — Extract
CSS selectors pull out the raw field values from each `<article class="product_pod">`:

| Field | Selector |
|---|---|
| Title | `h3 > a[title]` |
| Price | `.price_color` |
| Rating | `.star-rating` CSS class word |
| Availability | `.availability` |
| URL | `h3 > a[href]` + `urljoin` |

### Stage 4 — Clean
| Raw value | Cleaned value |
|---|---|
| `"£12.99"` | `12.99` (float) |
| `"Three"` | `3` (int) |
| `"In stock"` | `"In stock"` (stripped) |
| relative href | absolute URL |
| URL segment | category string (title-cased) |

### Stage 5 — Structure
Each cleaned record is a Python `dict`:
```json
{
  "title": "A Light in the Attic",
  "price": 51.77,
  "rating": 3,
  "availability": "In stock",
  "category": "Poetry",
  "url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html"
}
```

### Stage 6 — Save
- **`data/books.json`** — pretty-printed JSON array
- **`data/books.csv`** — CSV with header row

---

## Sample output (console)

```
=======================================================
  SCRAPE SUMMARY
=======================================================
  Total books    : 1000
  Pages scraped  : 50
  Categories     : 50
  Price range    : £10.00 – £59.99
  Avg price      : £35.07
  Avg rating     : 2.93 / 5

  Output files:
    data/books.json
    data/books.csv
=======================================================
```

---

## Dependencies

| Package | Purpose |
|---|---|
| `requests` | HTTP fetching |
| `beautifulsoup4` | HTML parsing |
| `lxml` | Fast HTML parser back-end for BeautifulSoup |
