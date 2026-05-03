
import requests

try:
    res = requests.get('http://localhost:3000/api/health', timeout=5)
    print(f"Status: {res.status_code}")
    print(res.text)
except Exception as e:
    print(f"Error: {e}")
