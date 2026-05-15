import sys
import subprocess
import importlib.util
import logging

def ensure_dependencies():
    packages = {
        "requests": "requests",
        "pdfplumber": "pdfplumber",
        "pandas": "pandas",
        "google-generativeai": "google.generativeai",
        "beautifulsoup4": "bs4",
        "lxml": "lxml",
        "matplotlib": "matplotlib"
    }
    
    try:
        importlib.import_module("pip")
    except ImportError:
        import urllib.request
        urllib.request.urlretrieve("https://bootstrap.pypa.io/get-pip.py", "get-pip.py")
        subprocess.check_call([sys.executable, "get-pip.py", "--break-system-packages"])

    for pkg, module_name in packages.items():
        try:
            importlib.import_module(module_name)
        except ImportError:
            print(f"[{pkg}] not found. Installing...")
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", pkg, "--break-system-packages"])
            except subprocess.CalledProcessError:
                try:
                    subprocess.check_call([sys.executable, "-m", "pip", "install", pkg, "--user", "--break-system-packages"])
                except Exception as e:
                    print(f"Failed to install {pkg}: {e}")

ensure_dependencies()

import os
import re
import time
import csv
import argparse
import random
import threading
import concurrent.futures
import requests
import pdfplumber
import pandas as pd
import google.generativeai as genai
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
from urllib.parse import urljoin
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def fetch_free_proxies():
    """Fetches a list of free HTTP proxies from an API."""
    logging.info("Fetching new proxies from free proxy service...")
    proxies = []
    try:
        url = "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        for line in response.text.splitlines():
            line = line.strip()
            if line:
                proxies.append(f"http://{line}")
        logging.info(f"Fetched {len(proxies)} proxies.")
    except Exception as e:
        logging.error(f"Failed to fetch proxies: {e}")
    
    if not proxies:
        logging.warning("Using fallback proxy pool.")
        proxies = [
            "http://103.151.114.150:80",
            "http://185.196.220.67:80",
            "http://194.5.176.10:80",
            "http://200.7.200.18:80",
            "http://103.216.71.194:80",
            "http://103.88.243.68:80"
        ]
    return proxies

def get_robust_session():
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.google.com/",
        "Sec-Ch-Ua": '"Not?A_Brand";v="99", "Chromium";v="135"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
    })
    # We will handle retries manually in _request to allow proxy rotation
    retry = Retry(
        total=1,
        read=1,
        connect=1,
        backoff_factor=1,
        allowed_methods=["GET"]
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session

class KeralaLotteryScraper:
    def __init__(self, start_date, end_date, output_file="kerala_lottery_results.csv", error_file="errors.csv", delay=2):
        self.start_date = datetime.strptime(start_date, "%Y-%m-%d")
        self.end_date = datetime.strptime(end_date, "%Y-%m-%d")
        self.output_file = output_file
        self.error_file = error_file
        self.report_file = "ai_daily_reports.csv"
        self.delay = delay
        self.lock = threading.Lock()
        self.session = get_robust_session()
        self.proxy_pool = fetch_free_proxies()
        
        # Initialize Gemini
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key and api_key != "MY_GEMINI_API_KEY":
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-3-flash-preview') # Update to gemini-3-flash-preview as per context
        else:
            self.model = None
            logging.warning("GEMINI_API_KEY not found or invalid. AI reports will be disabled.")

        self.schedule = {
            0: ("Monday", "Win-Win"),
            1: ("Tuesday", "Sthree Sakthi"),
            2: ("Wednesday", "Akshaya"),
            3: ("Thursday", "Karunya Plus"),
            4: ("Friday", "Nirmal"),
            5: ("Saturday", "Karunya"),
            6: ("Sunday", "Pournami")
        }
        
        self.prizes = {
            "1st": 10000000,
            "2nd": 3000000,
            "3rd": 500000,
            "Consolation": 5000,
            "4th": 5000,
            "5th": 2000,
            "6th": 1000,
            "7th": 500,
            "8th": 200,
            "9th": 100
        }

    def generate_ai_report(self, date, results):
        if not self.model or not results:
            return None
        
        prompt = ""
        report_text = ""
        try:
            # Prepare summary data for Gemini
            summary = pd.DataFrame(results, columns=["Date", "Day", "Name", "Draw", "Tier", "Amount", "Series", "Num", "Last4"])
            
            # Identify repeating last 4 digits across all tiers
            repeats = summary[summary.duplicated('Last4', keep=False)]
            repeat_info = ""
            if not repeats.empty:
                repeat_groups = repeats.groupby('Last4')['Tier'].apply(list).to_dict()
                repeat_info = f"Repeating Last 4 Digits Found: {repeat_groups}"

            top_prizes = summary[summary['Tier'].isin(['1st', '2nd', '3rd'])].to_string()
            stats = summary['Tier'].value_counts().to_string()
            
            prompt = f"""
            Analyze the following Kerala State Lottery results for {date.strftime('%Y-%m-%d')}.
            Focus specifically on winning number patterns and the 'Last 4 Digits' behavior across ALL prize tiers (1st down to 9th).
            
            Top Prizes:
            {top_prizes}
            
            Prize Distribution (Tiers):
            {stats}
            
            {repeat_info}
            
            Perform a deep-dive analysis on the digit distribution of the 'Last 4 Digits' across all winning numbers.
            
            Generate a concise analytical report (exactly 3 sentences):
            1. Cross-Reference Analysis: Identify if specific 'Last 4 Digit' sequences from the top tiers (1st-3rd) appear in lower tiers, suggesting a sequence resonance across different prize categories.
            2. Machine Behavior & Sequences: Analyze the frequency of repeating number sequences or mirrored pairs and provide an insight into potential physical machine biases or 'hot' digit clusters observed today.
            3. Pattern Prediction Intelligence: Based on the detected digit repetition and sequence clusters, explicitly state what a player should notice regarding machine periodicity or digit resonance for future strategy.
            """
            
            try:
                response = self.model.generate_content(prompt)
            except Exception as api_e:
                error_msg = f"Gemini API call failed: {str(api_e)}"
                logging.error(f"AI Response API Error for {date.strftime('%Y-%m-%d')}. Prompt: {prompt[:100]}\nError: {error_msg}")
                self.log_error(date, "AI API Error", info=f"Error: {error_msg}")
                return f"AI API error: {error_msg}"
            
            # Use raw response text for logging if needed
            try:
                report_text = response.text.strip()
            except Exception as re:
                # Handle cases where response.text might fail (e.g., safety filters)
                error_msg = f"Failed to retrieve response text: {str(re)}"
                # Log full prompt and error details for better analysis
                logging.error(f"AI Response Data Error for {date.strftime('%Y-%m-%d')}. Prompt: {prompt}\nError: {error_msg}")
                self.log_error(date, "AI Response Data Error", info=f"Prompt: {prompt}\nError: {error_msg}")
                return f"AI error: {error_msg}"

            clean_report = report_text.replace("\n", " ")
            
            # Validation Suite
            discrepancies = []
            
            # 1. Structure/Sentence Count Check
            sentences = [s for s in re.split(r'(?<=[.!?])\s+', clean_report) if s]
            sentence_count = len(sentences)
            
            if sentence_count == 0:
                self.log_error(date, "AI Report Discrepancy: Empty Report", 
                               info=f"Prompt: {prompt[:1000]}... Raw Response: {report_text}")
                return "Error: AI generated an empty report."
                
            if sentence_count > 3:
                discrepancies.append(f"Verbose: {sentence_count} sentences (max 3)")
                
            # 2. Length Check
            if len(clean_report) < 50:
                 discrepancies.append(f"Too Short: {len(clean_report)} chars")
            elif len(clean_report) > 600:
                 discrepancies.append(f"Too Long: {len(clean_report)} chars")

            # 3. Format/Character Check (Remove Markdown or Code Blocks)
            if "```" in report_text or "`" in report_text:
                discrepancies.append("Format: Contains markdown code blocks")
                clean_report = clean_report.replace("```", "").replace("`", "")

            # 4. Content Verification (Check for expected keywords from prompt instructions)
            required_keywords = ["Pattern Prediction", "Last 4 Digit"]
            missing_keys = [k for k in required_keywords if k.lower() not in clean_report.lower()]
            if missing_keys:
                discrepancies.append(f"Content: Missing mandatory keywords ({', '.join(missing_keys)})")

            # 5. Professionalism Check (Basic heuristic)
            forbidden_phrases = ["I am an AI", "As a language model", "Sorry, I can't", "Here are the results"]
            found_forbidden = [p for p in forbidden_phrases if p.lower() in clean_report.lower()]
            if found_forbidden:
                discrepancies.append(f"Tone: Non-analytical phrasing detected ({', '.join(found_forbidden)})")

            # Log all discrepancies if any found
            if discrepancies:
                log_info = {
                    "Discrepancies": discrepancies,
                    "Prompt": prompt[:1000],
                    "RawResponse": report_text,
                    "CleanedReport": clean_report
                }
                self.log_error(date, "AI Policy Violation", info=str(log_info))

            return clean_report
        except Exception as e:
            error_details = f"Exception: {str(e)}"
            # Log full prompt and error details for better analysis
            logging.error(f"AI Report generation failed for {date.strftime('%Y-%m-%d')}. Prompt: {prompt}\nError: {error_details}")
            self.log_error(date, "AI Generation Exception", 
                           info=f"Prompt: {prompt}\nError: {error_details}")
            return f"AI report generation error: {str(e)}"

    def log_error(self, date, reason, url=None, status_code=None, info=None):
        with open(self.error_file, "a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                date.strftime("%Y-%m-%d"), 
                reason, 
                url if url else "N/A", 
                status_code if status_code else "N/A", 
                info if info else "N/A"
            ])

    def _get_random_proxy(self):
        if not self.proxy_pool:
            self.proxy_pool = fetch_free_proxies()
        if not self.proxy_pool:
             return None
        return random.choice(self.proxy_pool)

    def _request(self, method, url, max_proxy_retries=2, **kwargs):
        initial_backoff = 2.0
        for i in range(max_proxy_retries):
            proxy = self._get_random_proxy()
            proxies = {"http": proxy, "https": proxy} if proxy else None
            logging.info(f"Attempt {i+1}/{max_proxy_retries} Using proxy: {proxy} for {url}")
            try:
                kwargs.setdefault('timeout', 15)
                response = self.session.request(method, url, proxies=proxies, **kwargs)
                if response.status_code == 200:
                    return response
                
                if response.status_code == 429 or response.status_code >= 500:
                    logging.warning(f"Proxy {proxy} returned {response.status_code}. Rotating proxy...")
                    if proxy in self.proxy_pool:
                        self.proxy_pool.remove(proxy)
                else:
                    logging.error(f"URL: {url} | Status: {response.status_code} | Proxy: {proxy}")
                    return response
            except requests.exceptions.RequestException as e:
                logging.warning(f"Request exception with proxy {proxy} for {url}: {e}")
                if proxy and proxy in self.proxy_pool:
                    self.proxy_pool.remove(proxy)
            except Exception as e:
                logging.warning(f"Request failed with proxy {proxy} for {url}: {e}")
                if proxy and proxy in self.proxy_pool:
                    self.proxy_pool.remove(proxy)
            
            # Exponential backoff
            if i < max_proxy_retries - 1:
                sleep_time = initial_backoff * (2 ** i)
                logging.info(f"Backing off for {sleep_time} seconds before retrying...")
                time.sleep(sleep_time)
        
        # Last resort: try without proxy
        logging.info(f"All proxy attempts failed for {url}. Attempting without proxy.")
        kwargs.setdefault('timeout', 15)
        return self.session.request(method, url, **kwargs)

    def post_with_retry(self, url, payload, max_retries=3, initial_backoff=1):
        for i in range(max_retries):
            try:
                response = requests.post(url, json=payload, timeout=10)
                response.raise_for_status()
                logging.info(f"Successfully posted data to {url}")
                return True
            except requests.exceptions.RequestException as e:
                logging.warning(f"Failed to post to {url} (attempt {i+1}/{max_retries}): {e}")
                if i < max_retries - 1:
                    sleep_time = initial_backoff * (2 ** i)
                    time.sleep(sleep_time)
                else:
                    logging.error(f"Exhausted retries for posting to {url}")
        return False

    def get_pdf_pdf_url(self, date):
        date_str = date.strftime("%Y-%m-%d")
        
        try:
            year = date.strftime("%Y")
            month = date.strftime("%m")
            
            # Phase 1: Try official portal
            official_url = "https://statelottery.kerala.gov.in/index.php/lottery-result"
            try:
                response = self._request("GET", official_url, timeout=15)
                response.raise_for_status()
                
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(response.text, 'lxml')
                links = soup.find_all('a', href=True)
                target_variations = [
                    date.strftime("%d-%m-%Y"),
                    date.strftime("%Y-%m-%d"),
                    date.strftime("%d/%m/%Y")
                ]
                for link in links:
                    href = link['href']
                    text = link.get_text().lower()
                    if any(var in text or var in href for var in target_variations):
                        if href.lower().endswith('.pdf'):
                            return urljoin(official_url, href)
            except Exception as e:
                self.log_error(date, "Official Portal Failed", url=official_url, info=str(e))
                pass # Continue to fallback

            # Phase 2: Kerala Lottery Result Blogger
            archive_url = f"https://kerala-lottery-result.com/archive/{year}/{month}"
            
            try:
                response = self._request("GET", archive_url, timeout=15)
                response.raise_for_status()
            except requests.exceptions.RequestException as e:
                # If the specific month/year archive fails, also try the root or year archive
                self.log_error(date, "Month Archive Request Failed", url=archive_url, status_code=getattr(e.response, "status_code", None), info=str(e))
                # Fallback to year archive if month fails
                archive_url = f"https://kerala-lottery-result.com/archive/{year}"
                try:
                    response = self._request("GET", archive_url, timeout=15)
                    response.raise_for_status()
                except requests.exceptions.RequestException as fallback_e:
                    self.log_error(date, "Year Archive Fallback Failed", url=archive_url, status_code=getattr(fallback_e.response, "status_code", None), info=str(fallback_e))
                    return None

            from bs4 import BeautifulSoup
            soup = BeautifulSoup(response.text, 'lxml')
            
            links = soup.find_all('a', href=True)
            
            # Variations of date representation in URLs and link labels
            target_variations = [
                date.strftime("%d-%m-%Y"),
                date.strftime("%Y-%m-%d"),
                date.strftime("%d/%m/%Y"),
                f"{datetime.now().strftime('%b')}-{date.strftime('%Y')}".lower()
            ]

            # Common Lottery Prefix
            day_name, lottery_name = self.schedule[date.weekday()]
            lottery_prefixes = [lottery_name.lower().replace(" ", "-"), lottery_name.lower().replace(" ", "")]

            # Phase 1: Search for direct PDF links first (Best Case)
            for link in links:
                href = link['href']
                text = link.get_text().lower()
                
                # Check for either date match OR lottery name match on the exact date
                if any(var in text or var in href for var in target_variations) or any(prefix in href for prefix in lottery_prefixes):
                    if href.lower().endswith('.pdf'):
                        return urljoin(archive_url, href)
            
            # Phase 2: If no direct PDF, search for article/post pages that lead to the PDF
            for link in links:
                href = link['href']
                text = link.get_text().lower()
                
                if any(var in text or var in href for var in target_variations) or any(prefix in href for prefix in lottery_prefixes):
                    try:
                        sub_url = urljoin(archive_url, href)
                        
                        # Only follow if it looks like an HTML post rather than a non-HTML asset
                        if sub_url.endswith('.jpg') or sub_url.endswith('.png'):
                            continue

                        sub_res = self._request("GET", sub_url, timeout=10)
                        sub_res.raise_for_status()
                        
                        sub_soup = BeautifulSoup(sub_res.text, 'lxml')
                        pdf_links = sub_soup.find_all('a', href=True)
                        
                        for pdf_link in pdf_links:
                            pdf_href = pdf_link['href'].lower()
                            # It is common for "download pdf" links or links ending with .pdf to be present
                            if pdf_href.endswith('.pdf') or 'download' in pdf_href or 'result-pdf' in pdf_href:
                                # Ensure we don't accidentally grab a PDF of a different draw from sidebar
                                if any(var in pdf_href or var in pdf_link.get_text().lower() for var in target_variations) or any(prefix in pdf_href for prefix in lottery_prefixes):
                                    # Very confident match
                                    return urljoin(sub_url, pdf_link['href'])
                                elif pdf_href.endswith('.pdf'):
                                    # Fallback confident match
                                    return urljoin(sub_url, pdf_link['href'])
                    except requests.exceptions.RequestException as phase2_e:
                        self.log_error(date, "Phase 2 Discovery Request Failed", url=sub_url, info=str(phase2_e))
                        continue
                    except Exception as e:
                        continue

            # Phase 3: Additional Discovery Strategy - Check standard predictable path format
            predicted_url = f"https://kerala-lottery-result.com/wp-content/uploads/{year}/{month}/Kerala-Lottery-Result-{date.strftime('%d-%m-%Y')}.pdf"
            try:
                head_res = self._request("HEAD", predicted_url, timeout=5)
                if head_res.status_code == 200:
                    logging.info("Found PDF via predictable URL strategy.")
                    return predicted_url
            except Exception:
                pass

        except Exception as e:
            self.log_error(date, "Search Strategy Failure", url=archive_url if 'archive_url' in locals() else None, info=str(e))
            logging.warning(f"Dynamic lookup failed for {date_str}: {e}")

        return None

    def download_pdf(self, url, date):
        filename = f"temp_{date.strftime('%Y%m%d')}.pdf"
        try:
            # allow_redirects=True is default in requests, but set explicitly for clarity
            response = self._request("GET", url, stream=True, timeout=20, allow_redirects=True)
            response.raise_for_status()
            
            # Log if redirect happened
            if response.history:
                logging.info(f"Redirected to: {response.url}")
            with open(filename, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            return filename
        except requests.exceptions.RequestException as e:
            logging.error(f"Failed to download {url}: {e}")
            self.log_error(date, f"Download failed: {str(e)}", url=url, status_code=getattr(e.response, "status_code", None))
        except Exception as e:
            logging.error(f"Exception downloading {url}: {e}")
            self.log_error(date, f"Download Exception: {str(e)}", url=url)
        return None

    def parse_text(self, full_text, date, url=None):
        results = []
        day_name, lottery_name = self.schedule[date.weekday()]
        draw_no = "Unknown"
        pdf_detected_date = "Unknown"
        
        try:
            if not full_text.strip():
                raise ValueError("Empty text extracted")

            header_snippet = full_text[:500]
            footer_snippet = full_text[-500:]
            metadata_source = header_snippet + "\n" + footer_snippet

            draw_patterns = [
                r"Draw No[:\s]+([A-Z0-9-]+)",
                r"DRAW NO[:\s]+([A-Z0-9-]+)",
                r"Draw number[:\s]+([A-Z0-9-]+)",
                r"Result of.*?\((.*?)\)",
                r"NO\.[:\s]+([A-Z0-9-]+)"
            ]
            for dp in draw_patterns:
                draw_match = re.search(dp, metadata_source, re.IGNORECASE)
                if draw_match:
                    draw_no = draw_match.group(1).strip()
                    break
            
            date_patterns = [
                r"held on\s+([0-9]{2}[-/][0-9]{2}[-/][0-9]{4})",
                r"dated\s+([0-9]{2}[-/][0-9]{2}[-/][0-9]{4})",
                r"date[:\s]+([0-9]{2}[-/][0-9]{2}[-/][0-9]{4})",
                r"DRAW DATE[:\s]+([0-9]{2}[-/][0-9]{2}[-/][0-9]{4})",
                r"DATE[:\s]+([A-Z]+,\s+[0-9]{2}[A-Z]{2}\s+[A-Z]+,\s+[0-9]{4})"
            ]
            for dop in date_patterns:
                date_match = re.search(dop, metadata_source, re.IGNORECASE)
                if date_match:
                    pdf_detected_date = date_match.group(1).strip()
                    break

            if draw_no == "Unknown":
                self.log_error(date, "Header Resolution Warning: Draw No not detected", url=url, info="Check header/footer patterns")

            headers = []
            header_regex = r"(1st|2nd|3rd|4th|5th|6th|7th|8th|9th|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|CONSOLATION)\s?Prize"
            
            for match in re.finditer(header_regex, full_text, re.IGNORECASE):
                h_type = match.group(1).lower()
                norm_map = {
                    "first": "1st", "second": "2nd", "third": "3rd", 
                    "fourth": "4th", "fifth": "5th", "sixth": "6th", 
                    "seventh": "7th", "eighth": "8th", "ninth": "9th",
                    "consolation": "Consolation"
                }
                h_type = norm_map.get(h_type, h_type)
                if not (h_type.endswith("st") or h_type.endswith("nd") or h_type.endswith("rd") or h_type.endswith("th") or h_type == "Consolation"):
                    h_type_norm = h_type.capitalize()
                    if h_type_norm not in ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "Consolation"]:
                         digit_map = {"1":"1st", "2":"2nd", "3":"3rd", "4":"4th", "5":"5th", "6":"6th", "7":"7th", "8":"8th", "9":"9th"}
                         h_type = digit_map.get(h_type, h_type.capitalize())
                    else:
                         h_type = h_type_norm
                else:
                    h_type = h_type.capitalize()

                headers.append({
                    "name": match.group(0),
                    "type": h_type,
                    "start": match.start(),
                    "end": match.end()
                })

            headers.sort(key=lambda x: x["start"])

            for idx, header in enumerate(headers):
                section_start = header["end"]
                section_end = headers[idx+1]["start"] if idx + 1 < len(headers) else len(full_text)
                section_text = full_text[section_start:section_end]
                
                tier = header["type"]
                prize_val = self.prizes.get(tier, self.prizes.get(tier.lower(), 0))

                if tier in ["1st", "2nd", "3rd", "Consolation"]:
                    matches = re.findall(r"\b([A-Z]{1,2})\s?(\d{6})\b", section_text)
                    
                    for series, full_num in matches:
                        if not series.isalpha() or len(full_num) != 6:
                            self.log_error(date, "Validation Discrepancy", url=url, 
                                           info=f"Tier: {tier}, Series: {series}, Num: {full_num}, Reason: Invalid format")
                            continue

                        last_4 = full_num[-4:]
                        results.append([date.strftime("%Y-%m-%d"), day_name, lottery_name, draw_no, tier, prize_val, series, full_num, last_4])
                else:
                    numbers = re.findall(r"\b\d{4}\b", section_text)
                    for n in numbers:
                        if len(n) != 4:
                            self.log_error(date, "Data Validation Discrepancy", url=url, info=f"Tier: {tier}, Found: {n}, Reason: Prize number must be 4 digits")
                            continue

                        results.append([date.strftime("%Y-%m-%d"), day_name, lottery_name, draw_no, tier, prize_val, "NA", n, n])

            if not results:
                snippet = full_text[:300].replace("\n", " ")
                self.log_error(date, "No prize numbers found in text (Heuristic failed)", url=url, info=f"Snippet: {snippet}")

        except Exception as e:
            logging.error(f"Error parsing text: {e}")
            snippet = full_text[:150].replace("\n", " ") if full_text else "No text extracted"
            self.log_error(date, f"Parsing Error: {str(e)}", url=url, info=f"Snippet: {snippet}")
            
        return results

    def parse_pdf(self, pdf_path, date, url=None):
        full_text = ""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    page_num = i + 1
                    try:
                        page_text = page.extract_text()
                        if page_text:
                            full_text += page_text + "\n"
                        else:
                            logging.warning(f"No text extracted from page {page_num} of {pdf_path}")
                    except Exception as e:
                        logging.error(f"Error extracting text from page {page_num} of {pdf_path}: {e}")
                        continue
        except Exception as e:
            logging.error(f"Error opening/reading PDF {pdf_path}: {e}")
            self.log_error(date, f"PDF read error: {str(e)}", url=url)
            return []

        return self.parse_text(full_text, date, url)

    def get_keralalotteries_net_results(self, date):
        date_str = date.strftime("%d-%m-%Y")
        url = f"https://www.keralalotteries.net/feeds/posts/default?q={date_str}&alt=json"
        
        try:
            response = self._request("GET", url, timeout=15)
            if response.status_code != 200:
                self.log_error(date, "Feed request failed", url=url, status_code=response.status_code)
                return []
            
            data = response.json()
            entries = data.get("feed", {}).get("entry", [])
            
            for entry in entries:
                title = entry.get("title", {}).get("$t", "")
                if date_str in title:
                    content_html = entry.get("content", {}).get("$t", "")
                    # Extract text from HTML
                    text = re.sub(r'<style[^>]*>[\s\S]*?<\/style>', '', content_html, flags=re.IGNORECASE)
                    text = re.sub(r'<[^>]+>', ' ', text)
                    text = text.replace('&nbsp;', ' ').replace('&#8377;', '₹')
                    
                    results = self.parse_text(text, date, url=url)
                    if results:
                        return results
            return []
        except Exception as e:
            self.log_error(date, f"Feed fetch error: {str(e)}", url=url)
            return []

    def process_date(self, current_date):
        logging.info(f"Processing {current_date.strftime('%Y-%m-%d')}...")
        
        draw_results = []
        
        # Try keralalotteries.net feed first for real-time results as it's often faster
        logging.info(f"Checking keralalotteries.net feed for {current_date.strftime('%Y-%m-%d')}...")
        draw_results = self.get_keralalotteries_net_results(current_date)
        
        if not draw_results:
            logging.info(f"Feed unavailable. Attempting PDF lookup for {current_date.strftime('%Y-%m-%d')}...")
            pdf_url = self.get_pdf_pdf_url(current_date)
            if pdf_url:
                pdf_path = self.download_pdf(pdf_url, current_date)
                if pdf_path:
                    draw_results = self.parse_pdf(pdf_path, current_date, url=pdf_url)
                    if os.path.exists(pdf_path):
                        os.remove(pdf_path)

        if draw_results:
            # Save winning numbers
            for result in draw_results:
                # result is: [date, day, lottery, drawNo, tier, prize, series, num, last4]
                payload = {
                    "date": result[0],
                    "lotteryName": result[2],
                    "drawNo": result[3],
                    "tier": result[4],
                    "amount": float(result[5]),
                    "series": result[6],
                    "number": result[7],
                    "last4": result[8]
                }
                self.post_with_retry("http://localhost:3000/api/save-lottery-result", payload)
                    
            # Optionally keep local CSV if needed
            with self.lock:
                with open(self.output_file, "a", newline="") as f:
                    writer = csv.writer(f)
                    writer.writerows(draw_results)
            
            # Generate and save AI Daily Report
            ai_report = self.generate_ai_report(current_date, draw_results)
            if ai_report and not str(ai_report).startswith("AI error:"):
                day_name, lottery_name = self.schedule[current_date.weekday()]
                with self.lock:
                    with open(self.report_file, "a", newline="") as f:
                        writer = csv.writer(f)
                        writer.writerow([current_date.strftime("%Y-%m-%d"), lottery_name, ai_report])
                
                report_payload = {
                    "date": current_date.strftime("%Y-%m-%d"),
                    "lotteryName": lottery_name,
                    "report": ai_report
                }
                self.post_with_retry("http://localhost:3000/api/save-report", report_payload)
                logging.info(f"AI Analytics report generated and saved for {current_date.strftime('%Y-%m-%d')}.")

            logging.info(f"Successfully scraped {len(draw_results)} results for {current_date.strftime('%Y-%m-%d')}.")
        else:
            day_name, lottery_name = self.schedule[current_date.weekday()]
            with self.lock:
                self.log_error(current_date, f"Results not found for {lottery_name} (tried both PDF and Portal Feed)")
        return True

    def run(self, max_workers=5):
        # Check if file exists to decide on writing headers
        file_exists = os.path.exists(self.output_file)
        
        # Initialize output CSV
        with open(self.output_file, "a" if file_exists else "w", newline="") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["Draw_Date", "Day", "Lottery_Name", "Draw_No", "Prize_Tier", "Prize_Amount", "Series", "Full_Number", "Last_4"])

        # Initialize AI report CSV
        file_exists_report = os.path.exists(self.report_file)
        with open(self.report_file, "a" if file_exists_report else "w", newline="") as f:
            writer = csv.writer(f)
            if not file_exists_report:
                writer.writerow(["Date", "Lottery_Name", "AI_Report"])

        # Initialize error CSV
        file_exists_error = os.path.exists(self.error_file)
        with open(self.error_file, "a" if file_exists_error else "w", newline="") as f:
            writer = csv.writer(f)
            if not file_exists_error:
                writer.writerow(["Date", "Reason", "URL", "Status_Code", "Additional_Info"])

        # Create list of dates to process
        dates_to_process = []
        current_date = self.start_date
        while current_date <= self.end_date:
            dates_to_process.append(current_date)
            current_date += timedelta(days=1)

        logging.info(f"Starting parallel processing with {max_workers} workers for {len(dates_to_process)} dates.")
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Map the processing function to each date
            # Note: We don't use delay here in the same way because 
            # parallel requests already act as a form of "anti-delay"
            # If the user still wants a delay between STARTING threads, that's complex
            # But usually parallel processing is intended to bypass sequential delays.
            executor.map(self.process_date, dates_to_process)

        # Generate Visualization Chart
        self.generate_prize_chart()

    def generate_prize_chart(self):
        """Generates a bar chart of the prize distribution across tiers."""
        try:
            if not os.path.exists(self.output_file):
                logging.warning("Output file not found. Skipping chart generation.")
                return

            df = pd.read_csv(self.output_file)
            if df.empty:
                logging.warning("Output CSV is empty. Skipping chart generation.")
                return

            # Aggregate data: Count occurrences per tier
            prize_counts = df['Prize_Tier'].value_counts()
            
            # Sort tiers meaningfully if possible (1st, 2nd, 3rd, etc.)
            tier_order = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', 'Consolation']
            prize_counts = prize_counts.reindex(tier_order).dropna()

            if prize_counts.empty:
                logging.warning("No standard prize tiers found for visualization.")
                return

            plt.figure(figsize=(12, 7))
            bars = plt.bar(prize_counts.index, prize_counts.values, color='skyblue', edgecolor='#141414')
            
            # Add labels and formatting
            plt.title('Kerala Lottery Prize Distribution (2012-2026)', fontsize=16, fontweight='bold', pad=20)
            plt.xlabel('Prize Tier', fontsize=12)
            plt.ylabel('Number of Winners', fontsize=12)
            plt.xticks(fontsize=10)
            plt.grid(axis='y', linestyle='--', alpha=0.7)

            # Add data labels on top of bars
            for bar in bars:
                height = bar.get_height()
                plt.text(bar.get_x() + bar.get_width() / 2.0, height, f'{int(height)}', 
                         ha='center', va='bottom', fontsize=10)

            # Save the chart
            chart_filename = os.path.splitext(self.output_file)[0] + "_distribution.png"
            plt.tight_layout()
            plt.savefig(chart_filename, dpi=300)
            plt.close()
            logging.info(f"Prize distribution chart saved as '{chart_filename}'")
            
        except Exception as e:
            logging.error(f"Failed to generate visualization chart: {e}")

if __name__ == "__main__":
    def validate_date_format(date_string):
        """Validates that a string is in YYYY-MM-DD format."""
        try:
            # Try to parse the date to ensure it's a real date (e.g. not Feb 30th)
            parsed_date = datetime.strptime(date_string, "%Y-%m-%d")
            return date_string
        except ValueError:
            raise argparse.ArgumentTypeError(
                f"Invalid date: '{date_string}'. Reason: Must be a real date in 'YYYY-MM-DD' format (e.g., 2023-12-31)."
            )

    parser = argparse.ArgumentParser(
        description="Intelligence Engine for Kerala Lottery Result Extraction",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    parser.add_argument(
        "--start", 
        type=validate_date_format, 
        default="2012-01-01", 
        help="Start date for extraction (YYYY-MM-DD)"
    )
    parser.add_argument(
        "--end", 
        type=validate_date_format, 
        default="2026-04-29", 
        help="End date for extraction (YYYY-MM-DD)"
    )
    parser.add_argument(
        "--output", 
        type=str, 
        default="kerala_lottery_results.csv", 
        help="Target CSV filename for winning numbers"
    )
    parser.add_argument(
        "--delay", 
        type=float, 
        default=2.0, 
        help="Rate-limiting delay in seconds (only applied in non-parallel mode)"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=5,
        help="Number of parallel workers for scraping"
    )
    
    args = parser.parse_args()
    
    # Range Validation: Start must precede or equal End
    if args.start > args.end:
        parser.error(
            f"Configuration Conflict: The start date '{args.start}' occurs after the end date '{args.end}'. "
            "Please ensure the start date is chronologically before the end date."
        )
    
    # Delay Validation
    if args.delay < 0:
        parser.error("Constraint Violation: The --delay value must be a non-negative number.")
    
    logging.info("--- Kerala Lottery Intelligence Engine Initialized ---")
    logging.info(f"Range: {args.start} to {args.end}")
    logging.info(f"Target: {args.output}")
    logging.info(f"Parallelism: {args.workers} workers")
    
    scraper = KeralaLotteryScraper(args.start, args.end, args.output, delay=args.delay)
    scraper.run(max_workers=args.workers)
