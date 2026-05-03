import requests
url = "https://www.keralalotteries.net/feeds/posts/default?q=02-05-2026&alt=json"
res = requests.get(url, timeout=15)
print(res.status_code)
print(res.text[:500])
