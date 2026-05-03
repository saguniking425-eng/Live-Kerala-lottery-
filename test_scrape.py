import requests
from bs4 import BeautifulSoup
res = requests.get("https://www.keralalotteries.net/?m=1")
soup = BeautifulSoup(res.text, 'html.parser')
for a in soup.find_all('a', href=True):
    if 'keralalotteries.net' in a['href'] and ('result' in a['href'] or 'pdf' in a['href'] or '.html' in a['href']):
        print(a['href'])
