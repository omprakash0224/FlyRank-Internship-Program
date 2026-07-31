"""
scraper.py — Books to Scrape Workshop Pipeline
================================================
Pipeline: fetch → parse → extract → clean → structure → save

Site: https://books.toscrape.com  (a purpose-built scraping sandbox)

Ethical practices applied:
  ✓ robots.txt is checked before any crawl begins
  ✓ A descriptive User-Agent identifies this bot and its author
  ✓ A configurable rate-limit delay sits between every request
  ✓ Timeouts prevent hanging connections

Usage:
    python scraper.py                   # scrape all pages
    python scraper.py --pages 3         # scrape first 3 pages only
    python scraper.py --delay 2.0       # set 2-second delay between requests
    python scraper.py --out-dir output  # custom output directory
"""

import argparse
import csv
import json
import logging
import os
import sys
import time
from urllib.parse import urljoin
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = "https://books.toscrape.com/"
USER_AGENT = (
    "ScraperWorkshopBot/1.0 (FlyRank Internship Practice; "
    "educational use only; contact: intern@flyrank.com)"
)
DEFAULT_DELAY = 1.5   # seconds between requests
DEFAULT_PAGES = None  # None = scrape all pages
DEFAULT_OUT_DIR = "data"

RATING_WORDS = {"One": 1, "Two": 2, "Three": 3, "Four": 4, "Five": 5}

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Stage 0 — robots.txt compliance
# ---------------------------------------------------------------------------

def check_robots(base_url: str, user_agent: str) -> RobotFileParser:
    """
    Fetch and parse robots.txt for the target site.

    Returns a RobotFileParser instance that can answer can_fetch() queries.
    If robots.txt cannot be fetched, a permissive parser is returned and a
    warning is logged (fail-open so a network hiccup doesn't silently break
    the crawl — the site owner's intent is respected when available).
    """
    robots_url = urljoin(base_url, "/robots.txt")
    log.info("Stage 0 — checking robots.txt at %s", robots_url)

    rp = RobotFileParser()
    rp.set_url(robots_url)
    try:
        rp.read()
        log.info("robots.txt parsed successfully.")
    except Exception as exc:  # noqa: BLE001
        log.warning("Could not fetch robots.txt (%s). Proceeding with caution.", exc)

    # Sanity-check: confirm the start URL is allowed
    if not rp.can_fetch(user_agent, base_url):
        log.error(
            "robots.txt disallows crawling %s for this bot. Exiting.", base_url
        )
        sys.exit(1)

    log.info("robots.txt allows crawling. Proceeding.")
    return rp


# ---------------------------------------------------------------------------
# Stage 1 — Fetch
# ---------------------------------------------------------------------------

def fetch_page(url: str, session: requests.Session) -> BeautifulSoup | None:
    """
    Fetch a single URL and return a parsed BeautifulSoup tree.

    Returns None on any HTTP or connection error so the caller can skip
    gracefully rather than crash the whole run.
    """
    try:
        response = session.get(url, timeout=10)
        response.raise_for_status()
        log.debug("Fetched %s  [%d]", url, response.status_code)
        return BeautifulSoup(response.text, "lxml")
    except requests.RequestException as exc:
        log.warning("Failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Stage 2 + 3 — Parse & Extract
# ---------------------------------------------------------------------------

def extract_books_from_page(soup: BeautifulSoup, page_url: str) -> list[dict]:
    """
    Parse one catalogue page and return a list of raw book dicts.

    Raw means the values are exactly as found in the HTML — cleaning
    happens in Stage 4.
    """
    raw_books = []
    articles = soup.select("article.product_pod")

    for article in articles:
        # --- title -----------------------------------------------------------
        title_tag = article.select_one("h3 > a")
        title = title_tag["title"] if title_tag else ""

        # --- price -----------------------------------------------------------
        price_tag = article.select_one(".price_color")
        price_raw = price_tag.get_text(strip=True) if price_tag else ""

        # --- rating (stored as CSS class word, e.g. "Three") ----------------
        rating_tag = article.select_one(".star-rating")
        rating_word = ""
        if rating_tag:
            classes = rating_tag.get("class", [])
            # class list looks like ["star-rating", "Three"]
            rating_word = next(
                (c for c in classes if c != "star-rating"), ""
            )

        # --- availability ----------------------------------------------------
        avail_tag = article.select_one(".availability")
        availability_raw = avail_tag.get_text(strip=True) if avail_tag else ""

        # --- relative URL → absolute URL ------------------------------------
        href = title_tag["href"] if title_tag else ""
        # href is like "../../.../book.html" relative to the catalogue page
        book_url = urljoin(page_url, href)

        raw_books.append(
            {
                "title": title,
                "price_raw": price_raw,
                "rating_word": rating_word,
                "availability_raw": availability_raw,
                "url": book_url,
            }
        )

    return raw_books


def extract_next_page_url(soup: BeautifulSoup, current_url: str) -> str | None:
    """Return the absolute URL of the next catalogue page, or None."""
    next_btn = soup.select_one("li.next > a")
    if not next_btn:
        return None
    return urljoin(current_url, next_btn["href"])


def extract_category_from_url(url: str) -> str:
    """
    Derive a human-readable category from a book's URL.

    URL pattern:  .../catalogue/category/books/<name>_<id>/...
    Falls back to "unknown" if the pattern is not found.
    """
    parts = url.split("/")
    # find the segment after "books" in the path
    try:
        books_idx = parts.index("books")
        raw = parts[books_idx + 1]          # e.g. "mystery_3"
        name = raw.rsplit("_", 1)[0]        # strip trailing _id
        return name.replace("-", " ").title()
    except (ValueError, IndexError):
        return "Unknown"


# ---------------------------------------------------------------------------
# Stage 4 — Clean
# ---------------------------------------------------------------------------

def clean_book(raw: dict) -> dict:
    """
    Transform a raw book dict into a clean, typed record.

    Transformations:
      • price_raw  →  price (float, £ symbol and whitespace removed)
      • rating_word → rating (int 1–5)
      • availability_raw → availability (normalized string)
      • url         → url + category (derived)
    """
    # price: strip currency symbol(s) and convert to float
    price_str = raw["price_raw"].replace("£", "").replace("Â", "").strip()
    try:
        price = float(price_str)
    except ValueError:
        price = None

    # rating: word → int
    rating = RATING_WORDS.get(raw["rating_word"], None)

    # availability: collapse whitespace
    availability = " ".join(raw["availability_raw"].split())

    # category from URL
    category = extract_category_from_url(raw["url"])

    return {
        "title": raw["title"].strip(),
        "price": price,
        "rating": rating,
        "availability": availability,
        "category": category,
        "url": raw["url"],
    }


# ---------------------------------------------------------------------------
# Stage 5 — Structure  (list comprehension — happens inline in main)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Stage 6 — Save
# ---------------------------------------------------------------------------

def save_json(books: list[dict], path: str) -> None:
    """Serialize the book list to a formatted JSON file."""
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(books, fh, indent=2, ensure_ascii=False)
    log.info("Saved %d records → %s", len(books), path)


def save_csv(books: list[dict], path: str) -> None:
    """Serialize the book list to a CSV file with a header row."""
    if not books:
        log.warning("No books to save to CSV.")
        return
    fieldnames = list(books[0].keys())
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(books)
    log.info("Saved %d records → %s", len(books), path)


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run(pages_limit: int | None, delay: float, out_dir: str) -> None:
    """
    Orchestrate the full scraping pipeline.

    Args:
        pages_limit: Maximum number of catalogue pages to scrape.
                     None means scrape until no next-page link is found.
        delay:       Seconds to sleep between page requests.
        out_dir:     Directory where output files are written.
    """
    os.makedirs(out_dir, exist_ok=True)

    # ------------------------------------------------------------------ #
    # Stage 0 — robots.txt                                                #
    # ------------------------------------------------------------------ #
    check_robots(BASE_URL, USER_AGENT)

    # ------------------------------------------------------------------ #
    # Set up a requests Session with a persistent User-Agent              #
    # ------------------------------------------------------------------ #
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    # ------------------------------------------------------------------ #
    # Crawl loop                                                          #
    # ------------------------------------------------------------------ #
    all_books: list[dict] = []
    current_url: str | None = BASE_URL
    page_num = 0

    while current_url:
        page_num += 1
        if pages_limit is not None and page_num > pages_limit:
            log.info("Reached page limit (%d). Stopping.", pages_limit)
            break

        log.info("Page %d — %s", page_num, current_url)

        # Stage 1 — Fetch
        soup = fetch_page(current_url, session)
        if soup is None:
            log.warning("Skipping page %d due to fetch error.", page_num)
            break

        # Stage 2 + 3 — Parse & Extract
        raw_books = extract_books_from_page(soup, current_url)
        log.info("  Extracted %d raw book(s).", len(raw_books))

        # Stage 4 — Clean  |  Stage 5 — Structure
        clean_books = [clean_book(rb) for rb in raw_books]
        all_books.extend(clean_books)

        # Advance to next page
        current_url = extract_next_page_url(soup, current_url)

        # Rate limit — be a polite bot
        if current_url:
            log.debug("  Sleeping %.1fs before next request…", delay)
            time.sleep(delay)

    log.info("Crawl complete. Total books collected: %d", len(all_books))

    # ------------------------------------------------------------------ #
    # Stage 6 — Save                                                      #
    # ------------------------------------------------------------------ #
    json_path = os.path.join(out_dir, "books.json")
    csv_path  = os.path.join(out_dir, "books.csv")

    save_json(all_books, json_path)
    save_csv(all_books, csv_path)

    # ------------------------------------------------------------------ #
    # Quick quality summary                                               #
    # ------------------------------------------------------------------ #
    prices = [b["price"] for b in all_books if b["price"] is not None]
    ratings = [b["rating"] for b in all_books if b["rating"] is not None]
    categories = {b["category"] for b in all_books}

    print("\n" + "=" * 55)
    print("  SCRAPE SUMMARY")
    print("=" * 55)
    print(f"  Total books    : {len(all_books)}")
    print(f"  Pages scraped  : {page_num}")
    print(f"  Categories     : {len(categories)}")
    if prices:
        print(f"  Price range    : £{min(prices):.2f} – £{max(prices):.2f}")
        print(f"  Avg price      : £{sum(prices)/len(prices):.2f}")
    if ratings:
        print(f"  Avg rating     : {sum(ratings)/len(ratings):.2f} / 5")
    print(f"\n  Output files:")
    print(f"    {json_path}")
    print(f"    {csv_path}")
    print("=" * 55 + "\n")


# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Books-to-Scrape workshop pipeline.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--pages",
        type=int,
        default=None,
        metavar="N",
        help="Number of catalogue pages to scrape (default: all).",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
        metavar="SECONDS",
        help=f"Delay between requests in seconds (default: {DEFAULT_DELAY}).",
    )
    parser.add_argument(
        "--out-dir",
        type=str,
        default=DEFAULT_OUT_DIR,
        metavar="DIR",
        help=f"Output directory for JSON and CSV files (default: {DEFAULT_OUT_DIR!r}).",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(pages_limit=args.pages, delay=args.delay, out_dir=args.out_dir)
