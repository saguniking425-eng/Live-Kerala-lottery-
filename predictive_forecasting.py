import sys
import subprocess
import importlib.util
import logging

def ensure_dependencies():
    packages = {
        "requests": "requests",
        "google-generativeai": "google.generativeai"
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

import json
import argparse
import csv
import os
from datetime import datetime

import google.generativeai as genai
import requests

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class ForecastingModule:
    def __init__(self, data_file="kerala_lottery_results.csv"):
        self.data_file = data_file
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key and api_key != "MY_GEMINI_API_KEY":
            logging.info("Initializing GenAI with API key.")
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-3-flash-preview')
        else:
            logging.error("GEMINI_API_KEY not found or invalid.")
            raise Exception("GEMINI_API_KEY not found or invalid.")

    def run_forecast(self, target_date):
        logging.info(f"Running forecast for {target_date}")
        if not os.path.exists(self.data_file):
            logging.error(f"Data file {self.data_file} not found.")
            raise Exception("Data file not found.")
        
        # Read CSV using standard csv module
        recent_data = []
        try:
            with open(self.data_file, 'r') as f:
                reader = csv.DictReader(f)
                recent_data = list(reader)
        except Exception as e:
            logging.error(f"Failed to read data file: {e}")
            raise e
        
        # Sort by Draw_Date descending and take top 10
        try:
            recent_data.sort(key=lambda x: x['Draw_Date'], reverse=True)
            top_10 = recent_data[:10]
            
            # Format as string
            recent_data_str = json.dumps(top_10, indent=2)
            
            prompt = f"""
            Analyze the following recent Kerala lottery results and predict winning numbers for {target_date}.
            
            {recent_data_str}
            
            Provide a prediction of winning numbers, a confidence score (0-1 as a number), and a concise basis for the prediction (as a string).
            
            Return the response in JSON format with keys: "predictedNumbers", "confidenceScore", "analysisBasis".
            """
            
            logging.info(f"Sending prompt to Gemini for forecast.")
            # Use simple generate_content
            response = self.model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
            
            forecast = json.loads(response.text)
            logging.info("Forecast generated successfully.")
            
            # Save to Firestore via API
            payload = {
                "date": target_date,
                "targetLottery": "Predictive",
                "predictedSegments": str(forecast["predictedNumbers"]),
                "confidenceScore": float(forecast["confidenceScore"]),
                "analysisBasis": forecast["analysisBasis"]
            }
            
            try:
                requests.post("http://localhost:3000/api/save-forecast", json=payload, timeout=5)
                logging.info("Forecast saved successfully.")
            except Exception as e:
                logging.error(f"Failed to post forecast to API: {e}")
                raise e
        except Exception as e:
            logging.error(f"Error during forecast execution: {e}")
            raise e

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True, help="Target date YYYY-MM-DD")
    args = parser.parse_args()
    
    module = ForecastingModule()
    module.run_forecast(args.date)
