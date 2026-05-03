# Kerala Lottery Data Scraper

A robust Python script to download and parse Kerala State Lottery results from 2012 to 2026.

## Features
- **Historical Coverage**: Scrapes data from Jan 1, 2012, to April 29, 2026.
- **Multil-Source Support**: Uses `result.keralalotteries.com` as primary and `kerala-lottery-result.com/archive` as secondary source.
- **Deep PDF Parsing**: Extracts 1st through 9th prize tiers using `pdfplumber`.
- **Structured Data**: Outputs a comprehensive CSV with all winning numbers.
- **Rate Limiting**: Built-in 2-second delay between requests to respect server limits.
- **Error Logging**: Comprehensive error tracking in `errors.csv`.

## Prerequisites
- Python 3.8+
- `pip`

## Installation
1. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage
Run the script using the following command:
```bash
python scrape_kerala_lottery.py --start 2012-01-01 --end 2026-04-29
```

### Arguments
- `--start`: Start date in YYYY-MM-DD format (default: 2012-01-01).
- `--end`: End date in YYYY-MM-DD format (default: 2026-04-29).
- `--output`: Name of the output CSV file (default: kerala_lottery_results.csv).
- `--delay`: Delay between requests in seconds (default: 2.0).

## Output Structure
The generated CSV contains the following columns:
- `Draw_Date`: Date of the draw.
- `Day`: Day of the week.
- `Lottery_Name`: Name of the lottery (e.g., Win-Win, Akshaya).
- `Draw_No`: Official draw number.
- `Prize_Tier`: 1st, 2nd, 3rd, etc.
- `Prize_Amount`: Value in INR.
- `Series`: 2-letter series (NA for 4th-9th prizes).
- `Full_Number`: The winning number.
- `Last_4`: Last 4 digits of the winning number.

## Draw Schedule
- Sunday: Pournami
- Monday: Win-Win
- Tuesday: Sthree Sakthi
- Wednesday: Akshaya
- Thursday: Karunya Plus
- Friday: Nirmal
- Saturday: Karunya
