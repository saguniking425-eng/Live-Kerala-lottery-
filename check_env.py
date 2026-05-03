import importlib
import logging
import subprocess
import sys

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def ensure_pip():
    try:
        importlib.import_module("pip")
    except ImportError:
        logging.info("pip not found, downloading get-pip.py...")
        import urllib.request
        urllib.request.urlretrieve("https://bootstrap.pypa.io/get-pip.py", "get-pip.py")
        subprocess.check_call([sys.executable, "get-pip.py", "--break-system-packages"])

ensure_pip()

required_packages = ['requests', 'pdfplumber', 'pandas', 'bs4', 'lxml', 'matplotlib']

with open('env_check.txt', 'w') as f:
    missing_packages = []
    for package in required_packages:
        try:
            importlib.import_module(package)
            logging.info(f"Successfully imported {package}")
        except ImportError:
            logging.info(f"Module not found: {package}, installing...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", package if package != 'bs4' else 'beautifulsoup4', '--break-system-packages'])
            try:
                importlib.import_module(package)
                logging.info(f"Successfully installed and imported {package}")
            except ImportError:
                logging.error(f"Failed to install module: {package}")
                missing_packages.append(package)
        except Exception as e:
            logging.error(f"Error importing {package}: {e}")
            f.write(f"Error importing {package}: {e}\n")
    
    if missing_packages:
        f.write(f"Missing packages: {', '.join(missing_packages)}\n")
    else:
        f.write("All required packages are installed.\n")
