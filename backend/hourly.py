import os
import json
import hashlib
from datetime import datetime
from pathlib import Path
import logging
import sys
import argparse
import re
import time # Added for Selenium wait

# --- Configure basic logging early for import errors ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger('feature_tracker_init') # Use a temp logger name initially
# ---

# --- Remove Environment Debugging ---
# print(f"DEBUG: Running Python executable: {sys.executable}")
# print("DEBUG: Python sys.path:")
# for p in sys.path:
#     print(f"  {p}")
# print("--- End Environment Debugging ---")
# ---

# Check for required packages and provide helpful error messages
missing_packages = []

try:
    import requests
except ImportError as e:
    logger.error(f"Failed to import 'requests': {e}. Please install it.")
    missing_packages.append("requests")

# Import Supabase client
try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError as e:
    logger.error(f"Failed to import 'supabase': {e}. Please install it.")
    SUPABASE_AVAILABLE = False
    missing_packages.append("supabase")

# Import BeautifulSoup (Still useful for parsing HTML if needed, though Selenium is primary now)
try:
    from bs4 import BeautifulSoup
except ImportError as e:
    logger.error(f"Failed to import 'BeautifulSoup' from 'bs4': {e}. Please install 'beautifulsoup4'.")
    missing_packages.append("beautifulsoup4")

# --- Add Selenium Imports ---
try:
    # from selenium import webdriver # Replaced by selenium-wire
    from selenium.webdriver.chrome.service import Service as ChromeService
    from selenium.webdriver.common.by import By
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    # SELENIUM_AVAILABLE = True # Checked via selenium-wire now
except ImportError as e:
    logger.error(f"Failed to import 'selenium' components: {e}. Please install 'selenium'.")
    # SELENIUM_AVAILABLE = False
    missing_packages.append("selenium") # Still list selenium as it's a base dependency

# --- Add Selenium-Wire Import ---
try:
    from seleniumwire import webdriver as webdriver_wire # Use seleniumwire's webdriver
    SELENIUM_WIRE_AVAILABLE = True
except ImportError as e: # Catch the specific error
    logger.error(f"Failed to import 'seleniumwire': {e}. Please install it.")
    SELENIUM_WIRE_AVAILABLE = False
    missing_packages.append("selenium-wire")
    # --- Remove detailed error logging ---
    # print(f"DEBUG: Failed to import seleniumwire. Error: {e}", file=sys.stderr) # Removed
    # ---
# ---

# --- Add undetected-chromedriver Import ---
try:
    import undetected_chromedriver as uc
    UNDETECTED_CHROMEDRIVER_AVAILABLE = True
except ImportError as e:
    logger.error(f"Failed to import 'undetected_chromedriver': {e}. Please install it.")
    UNDETECTED_CHROMEDRIVER_AVAILABLE = False
    missing_packages.append("undetected-chromedriver")
# ---

try:
    from webdriver_manager.chrome import ChromeDriverManager
    WEBDRIVER_MANAGER_AVAILABLE = True
except ImportError as e:
    logger.error(f"Failed to import 'webdriver_manager': {e}. Please install it.")
    # Try firefox as an alternative? For now, just require chrome.
    WEBDRIVER_MANAGER_AVAILABLE = False
    missing_packages.append("webdriver-manager")
# --- End Selenium Imports ---

# --- Add PyPasser Import ---
try:
    # Only import reCaptchaV2 as others seem unavailable in v0.0.5
    from pypasser import reCaptchaV2 #, reCaptchaV3, hCaptcha, normal_captcha
    PYPASSER_AVAILABLE = True
except ImportError as e:
    logger.error(f"Failed to import 'pypasser': {e}. Please install it.")
    PYPASSER_AVAILABLE = False
    missing_packages.append("pypasser")
# ---

# --- Add Pillow for image processing (needed by PyPasser) ---
try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError as e:
    logger.error(f"Failed to import 'PIL' (Pillow): {e}. Please install 'Pillow'.")
    PILLOW_AVAILABLE = False
    missing_packages.append("Pillow")
# ---

# If any required packages are missing, exit with instructions
if missing_packages:
    print("ERROR: Missing required packages. Please install them with:")
    print(f"pip install {' '.join(missing_packages)}")
    print("\nAlternatively, use requirements.txt:")
    print("pip install -r requirements.txt")
    sys.exit(1)

# Configure logging (re-configure with final name if needed, or just update logger name)
# logging.basicConfig(...) # Already configured above
logger = logging.getLogger('feature_tracker') # Update logger name

# Constants
CONFIG_PATH = Path(__file__).parent / 'config.txt'
DATA_DIR = Path(__file__).parent / 'data'
VERSIONS_FILE = DATA_DIR / 'versions.json'

def ensure_directories():
    """Ensure all necessary directories exist."""
    DATA_DIR.mkdir(exist_ok=True)
    versions_dir = DATA_DIR / 'versions'
    versions_dir.mkdir(exist_ok=True)
    return versions_dir

def load_config():
    """Load URLs, Supabase config, and dynamic sources from config file."""
    urls = []
    supabase_config = {
        'url': None,
        'key': None,
        'bucket': 'gemini-files'
    }
    dynamic_sources = {} # Added dictionary for dynamic sources

    try:
        with open(CONFIG_PATH, 'r') as f:
            in_supabase_section = False
            in_dynamic_section = False # Added flag for dynamic section

            for line in f:
                line = line.strip()

                # Skip empty lines and comments
                if not line or line.startswith('#'):
                    continue

                # Check for section headers
                if line == '[supabase]':
                    in_supabase_section = True
                    in_dynamic_section = False
                    continue
                elif line == '[dynamic_sources]': # Added dynamic section check
                    in_supabase_section = False
                    in_dynamic_section = True
                    continue
                elif line.startswith('['): # Handle other potential sections
                    in_supabase_section = False
                    in_dynamic_section = False
                    continue

                # Parse Supabase config
                if in_supabase_section:
                    if '=' in line:
                        key, value = line.split('=', 1)
                        if key in supabase_config:
                            supabase_config[key] = value
                # Parse Dynamic Sources config
                elif in_dynamic_section: # Added parsing for dynamic sources
                    if '=' in line:
                        key, value = line.split('=', 1)
                        if ',' in value:
                            # --- Corrected parsing ---
                            # The key is the unique name (e.g., 'gemini')
                            # The value contains the URL and pattern separated by a comma
                            source_url, pattern = value.split(',', 1)
                            dynamic_sources[key.strip()] = {'url': source_url.strip(), 'pattern': pattern.strip()}
                            # --- End correction ---
                        else:
                            logger.warning(f"Invalid format for dynamic source '{key}'. Expected 'unique_name=url,pattern'. Skipping.")
                # Parse static URLs (must not be in any section)
                elif not in_supabase_section and not in_dynamic_section:
                    urls.append(line)

        logger.info(f"Loaded {len(urls)} static URLs from config file")
        if supabase_config['url'] and supabase_config['key']:
            logger.info("Loaded Supabase configuration")
        if dynamic_sources:
             logger.info(f"Loaded {len(dynamic_sources)} dynamic URL sources from config file")

        return urls, supabase_config, dynamic_sources # Return dynamic_sources
    except FileNotFoundError:
        logger.error(f"Config file not found at {CONFIG_PATH}")
        # Create example config
        with open(CONFIG_PATH, 'w') as f:
            f.write("# Add static URLs to monitor, one per line\n")
            f.write("# https://example.com/static_file.txt\n\n")
            f.write("# Add dynamic URL sources\n")
            f.write("# Format: unique_name=url_to_fetch_html_from,url_pattern_to_extract\n")
            f.write("[dynamic_sources]\n")
            f.write("# gemini=https://gemini.google.com/,https://gstatic.com/_/mss/\n\n")
            f.write("# Supabase configuration\n")
            f.write("[supabase]\n")
            f.write("url=https://your-project-url.supabase.co\n")
            f.write("key=your-limited-permission-key-here\n")
            f.write("bucket=your-bucket-name\n")
        logger.info(f"Created example config file at {CONFIG_PATH}")
        return [], supabase_config, {} # Return empty dict for dynamic_sources

def load_versions():
    """Load existing versions data."""
    if VERSIONS_FILE.exists():
        with open(VERSIONS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_versions(versions_data, debug=False): # Added debug flag
    """Save versions data to JSON file."""
    if debug:
        logger.info("[DEBUG] Would save updated versions data to %s", VERSIONS_FILE)
        return

    with open(VERSIONS_FILE, 'w') as f:
        json.dump(versions_data, f, indent=2)
    logger.info("Updates saved to versions file")

def get_file_hash(content):
    """Generate a hash for file content."""
    return hashlib.md5(content.encode('utf-8') if isinstance(content, str) else content).hexdigest()

def fetch_url(url):
    """Fetch content from a URL."""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        logger.error(f"Error fetching {url}: {e}")
        return None

def solve_captcha(driver, debug=False): # Removed captcha_type argument
    """
    Attempts to solve reCAPTCHA v2 using PyPasser.

    Args:
        driver: WebDriver instance
        debug: Whether to run in debug mode

    Returns:
        bool: True if CAPTCHA was solved, False otherwise
    """
    if not PYPASSER_AVAILABLE:
        logger.warning("PyPasser not available. Cannot solve CAPTCHAs automatically.")
        return False

    try:
        logger.info("Attempting to solve reCAPTCHA v2 using PyPasser...")

        # Find reCAPTCHA elements (specifically iframe)
        recaptcha_iframe = None
        try:
            # Wait briefly for iframe to appear
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            wait = WebDriverWait(driver, 5) # Wait up to 5 seconds
            recaptcha_iframe = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "iframe[title*='reCAPTCHA']")))
            logger.info("Detected reCAPTCHA iframe on page")
        except:
            logger.debug("No reCAPTCHA iframe found within timeout.")
            # Fallback check for common div elements if iframe check fails
            recaptcha_elements = driver.find_elements(By.CSS_SELECTOR, ".g-recaptcha, .recaptcha")
            if not recaptcha_elements:
                 logger.debug("No visible reCAPTCHA elements found")
                 return False
            else:
                 logger.info("Found reCAPTCHA div element, proceeding...")


        # Get the site key (required by PyPasser)
        try:
            site_key = None
            # Try finding sitekey within the iframe first if it exists
            if recaptcha_iframe:
                driver.switch_to.frame(recaptcha_iframe)
                try:
                    # Look for the checkbox element which often has the sitekey
                    site_key_element = driver.find_element(By.ID, "recaptcha-token") # Common hidden input
                    site_key = site_key_element.get_attribute("data-sitekey")
                except:
                     # Fallback to searching common divs within iframe
                     site_key_element = driver.find_element(By.CSS_SELECTOR, ".g-recaptcha, [data-sitekey]")
                     site_key = site_key_element.get_attribute("data-sitekey")
                finally:
                    driver.switch_to.default_content() # Switch back out of iframe

            # If not found in iframe, try finding it in the main document
            if not site_key:
                 site_key = driver.execute_script("""
                    let el = document.querySelector(".g-recaptcha") || document.querySelector("[data-sitekey]");
                    return el ? el.getAttribute("data-sitekey") : null;
                """)

            if not site_key:
                logger.warning("Could not find reCAPTCHA site key")
                return False

            logger.info(f"Found reCAPTCHA site key: {site_key}")

            # Get current URL
            url = driver.current_url

            # Solve the reCAPTCHA using PyPasser
            if debug:
                logger.debug(f"[DEBUG] Would solve reCAPTCHA v2 with site key {site_key} at {url}")
                # In debug mode, we might need to manually interact or just simulate success
                # For now, simulate success
                return True

            # --- PyPasser reCaptchaV2 Call ---
            # Ensure Pillow is available for potential image processing by pypasser
            if not PILLOW_AVAILABLE:
                 logger.warning("Pillow library not found, PyPasser might fail for image challenges.")

            # Note: pypasser v0.0.5 might still require ffmpeg/avconv for audio challenges
            # Check for pydub warning suppression if needed, but focus on visual solve first.
            try:
                 response = reCaptchaV2(sitekey=site_key, url=url, driver=driver) # Pass driver
            except Exception as pye:
                 logger.error(f"PyPasser reCaptchaV2 solver failed: {pye}", exc_info=True)
                 return False
            # ---

            if response:
                logger.info("PyPasser returned a potential solution token.")
                # Input the solution - pypasser v0.0.5 might do this automatically if driver is passed
                # If not, uncomment and adapt the JS below
                # try:
                #     driver.execute_script(f"""
                #         let el = document.getElementById("g-recaptcha-response");
                #         if (el) el.innerHTML = "{response}";
                #         // Attempt to find and submit the form if needed
                #         // let form = el ? el.closest('form') : document.querySelector('form');
                #         // if (form) form.submit();
                #     """)
                #     time.sleep(3)  # Wait for potential form submission/page change
                #     logger.info("reCAPTCHA solution injected (or handled by PyPasser).")
                #     # We might need to check if the CAPTCHA is truly gone here
                #     return True # Assume success if response is received
                # except Exception as js_error:
                #      logger.error(f"Error injecting reCAPTCHA solution via JavaScript: {js_error}")
                #      return False
                return True # Assume pypasser handled injection if response is truthy
            else:
                 logger.warning("PyPasser reCaptchaV2 did not return a solution.")
                 return False

        except Exception as e:
            logger.error(f"Error finding site key or executing script for reCAPTCHA: {e}", exc_info=True)
            # Ensure we switch back from iframe if an error occurred within it
            try:
                driver.switch_to.default_content()
            except: pass # Ignore errors if already in default content
            return False

    except Exception as e:
        logger.error(f"Error during CAPTCHA solving process: {e}", exc_info=True)
        return False
    # finally: # Keep screenshot files in debug mode? For now, remove always.
    #     # Clean up temporary files
    #     try:
    #         import os
    #         if os.path.exists("temp_captcha_screenshot.png"):
    #             os.remove("temp_captcha_screenshot.png")
    #         # Removed image captcha specific file
    #     except Exception as e:
    #         logger.warning(f"Could not remove temp captcha files: {e}")


def fetch_dynamic_urls(source_url, pattern, wait_time=10, debug=False, bypass_captcha_flag=False): # Added bypass_captcha_flag parameter
    """
    Fetch a source URL using Undetected ChromeDriver with PyPasser CAPTCHA bypassing,
    capture network requests, and filter them based on the pattern.
    """
    # --- Update availability check ---
    if not SELENIUM_WIRE_AVAILABLE and not UNDETECTED_CHROMEDRIVER_AVAILABLE:
        logger.error("Neither Selenium-Wire nor undetected-chromedriver is available. Cannot fetch dynamic URLs.")
        return []
    # ---

    # --- Log the correct URL being fetched ---
    logger.info(f"Fetching dynamic URLs from {source_url} matching pattern '{pattern}'")
    # ---
    found_urls = set()
    driver = None # Initialize driver to None

    try:
        # --- Setup Undetected ChromeDriver if available, otherwise fallback to Selenium-Wire ---
        if UNDETECTED_CHROMEDRIVER_AVAILABLE:
            logger.info("Using undetected-chromedriver to bypass CAPTCHA detection")
            options = uc.ChromeOptions()
            
            # Keep window visible in debug mode
            if debug:
                logger.info("Running browser with visible window (debug mode)")
            else:
                options.add_argument("--headless")
                
            # Add essential arguments
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            
            # Set a realistic user agent
            options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            
            # Add browser fingerprinting evasion
            options.add_argument("--disable-blink-features=AutomationControlled")
            
            # Create driver with undetected-chromedriver
            driver = uc.Chrome(options=options)
            driver.set_page_load_timeout(60)
            
            # Log success
            logger.info("Undetected ChromeDriver initialized successfully")
        else:
            # --- Fallback to selenium-wire webdriver ---
            logger.info("Fallback to selenium-wire (CAPTCHA may still appear)")
            chrome_options = ChromeOptions()
            if not debug:
                chrome_options.add_argument("--headless")
            else:
                logger.info("Running Selenium with visible browser (debug mode).")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            chrome_options.add_argument("--disable-blink-features=AutomationControlled")
            
            # Add plugins to look more human-like
            chrome_options.add_argument("--disable-extensions-except=/path/to/some/extension")
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)

            service = ChromeService(ChromeDriverManager().install())
            driver = webdriver_wire.Chrome(service=service, options=chrome_options)
            driver.set_page_load_timeout(60)
            
            # Clear existing requests in selenium-wire
            del driver.requests
            logger.debug("Cleared any previous network requests.")
        # ---

        logger.info(f"Navigating to {source_url}...")
        driver.get(source_url) # This should now receive the correct URL

        # Add random human-like behavior
        if UNDETECTED_CHROMEDRIVER_AVAILABLE:
            import random
            from selenium.webdriver.common.action_chains import ActionChains
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            
            # Random pause to simulate human behavior
            time.sleep(random.uniform(1, 3))
            
            # Scroll down a bit
            driver.execute_script("window.scrollTo(0, window.innerHeight / 2);")
            time.sleep(random.uniform(0.5, 1.5))
            
            # Move mouse randomly if in debug mode (visible browser)
            if debug:
                actions = ActionChains(driver)
                for _ in range(3):
                    x = random.randint(100, 700)
                    y = random.randint(100, 500)
                    actions.move_by_offset(x, y).perform()
                    time.sleep(random.uniform(0.3, 0.7))
        
        # --- Check for and solve CAPTCHA ---
        captcha_solved = False # Track if solved
        # Only attempt solving if the flag is set
        if bypass_captcha_flag:
            # Look for common CAPTCHA indicators in the page
            captcha_indicators = ['captcha', 'recaptcha', 'security check', 'verify you are human'] # Removed hcaptcha
            page_source_lower = driver.page_source.lower()

            # Check if indicators are present OR if specific reCAPTCHA elements exist
            is_captcha_present = any(indicator in page_source_lower for indicator in captcha_indicators)
            if not is_captcha_present:
                try:
                    # Explicitly check for reCAPTCHA iframe as indicator might not be in text
                    if driver.find_elements(By.CSS_SELECTOR, "iframe[title*='reCAPTCHA']"):
                        is_captcha_present = True
                        logger.info("Detected reCAPTCHA iframe, attempting solve.")
                except:
                    pass # Ignore if element not found

            if is_captcha_present:
                logger.info("Potential CAPTCHA detected on page - attempting to solve...")

                # Call the simplified solve_captcha function
                if solve_captcha(driver, debug):
                    logger.info("CAPTCHA potentially solved successfully by PyPasser!")
                    captcha_solved = True
                    # After solving CAPTCHA, give the page time to load new content
                    time.sleep(5) # Increased wait after solve attempt
                else:
                    logger.warning("Failed to solve CAPTCHA automatically.")

                    if debug:
                        # In debug mode, wait for manual solving
                        logger.info("Debug mode: Please solve the CAPTCHA manually if present...")
                        # Wait longer in debug mode for manual solving
                        manual_wait = 60
                        logger.info(f"Waiting {manual_wait} seconds for manual CAPTCHA solving...")
                        time.sleep(manual_wait)
                        # Assume solved manually in debug after wait
                        captcha_solved = True # Set to true to allow processing to continue
                    else:
                        logger.warning("Continuing without solving CAPTCHA, results may be limited.")
            else:
                 logger.info("No CAPTCHA indicators detected on the page.")
        else:
            logger.info("CAPTCHA bypassing is disabled via command-line flag.")
        # ---

        # Wait for page to fully load (adjust wait time if CAPTCHA was handled)
        effective_wait_time = wait_time if not captcha_solved else max(wait_time, 5) # Ensure at least 5s after solve attempt
        logger.info(f"Waiting {effective_wait_time} seconds for page activity...")
        time.sleep(effective_wait_time)

        # --- Capture Network Requests ---
        if UNDETECTED_CHROMEDRIVER_AVAILABLE:
            # For undetected-chromedriver, we need to extract URLs from page content or use a different approach
            logger.info("Extracting URLs from page content...")
            page_source = driver.page_source
            
            # Direct regex search in the page source for URLs matching the pattern
            clean_pattern = pattern.replace('https://', '').replace('http://', '')
            import re
            # Look for URLs in various contexts (script src, href, etc.)
            url_pattern = re.compile(r'(https?://[^"\'\s>]+' + re.escape(clean_pattern) + r'[^"\'\s>]*)')
            matches = url_pattern.findall(page_source)
            
            for url in matches:
                logger.debug(f"Adding URL matching pattern from page content: '{url}'")
                found_urls.add(url)
                
            # Also check network resources using JavaScript
            try:
                js_resources = driver.execute_script("""
                    let resources = [];
                    performance.getEntriesByType('resource').forEach(r => resources.push(r.name));
                    return resources;
                """)
                
                for url in js_resources:
                    if clean_pattern in url:
                        logger.debug(f"Adding URL matching pattern from performance resources: '{url}'")
                        found_urls.add(url)
            except Exception as e:
                logger.warning(f"Error getting performance resources: {e}")
                
        else:
            # Original selenium-wire approach
            logger.info("Extracting URLs from captured network requests...")
            captured_requests = driver.requests
            logger.info(f"Captured {len(captured_requests)} total requests during page load.")
            if debug:
                all_req_urls = [req.url for req in captured_requests]
                logger.debug("--- All captured request URLs ---")
                for req_url in sorted(list(set(all_req_urls))):
                    logger.debug(req_url)
                logger.debug("--- End of captured URLs ---")

            # Filter based on the pattern
            clean_pattern = pattern.replace('https://', '').replace('http://', '')
            for request in captured_requests:
                url = request.url
                if not url or not url.startswith(('http://', 'https://')):
                    logger.debug(f"Skipping invalid or non-HTTP request URL: {url}")
                    continue

                if clean_pattern in url:
                    logger.debug(f"Adding URL matching pattern from network request: '{url}'")
                    found_urls.add(url)
        # --- End Network Capture ---


        if not found_urls:
            logger.warning(f"No network requests containing pattern '{pattern}' were captured after loading {source_url}.")
        else:
            logger.info(f"Found {len(found_urls)} network requests matching pattern '{pattern}' at {source_url}")
        return list(found_urls)

    except Exception as e:
        # --- Log the correct URL in case of error ---
        logger.error(f"Error during Selenium fetch for {source_url}: {e}", exc_info=True)
        # ---
        # Ensure driver is quit even on error if not in debug mode
        if driver and not debug:
            logger.info("Closing Selenium browser due to error.")
            driver.quit()
            driver = None # Avoid trying to quit again in finally
        return []
    finally:
        # --- Conditionally quit driver ---
        if driver and not debug:
            logger.info("Closing Selenium browser.")
            driver.quit()
        elif driver and debug:
            logger.info("Debug mode: Keeping Selenium browser open.")
        # ---

def setup_supabase(supabase_config):
    """Setup Supabase client with configuration from config file."""
    if not SUPABASE_AVAILABLE:
        logger.warning("Supabase client not installed. Files will only be stored locally.")
        return None
    
    url = supabase_config.get('url')
    key = supabase_config.get('key')
    
    if not url or not key:
        logger.warning("Supabase credentials not found in config file.")
        return None
    
    try:
        supabase = create_client(url, key)
        return supabase
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None

def upload_to_supabase(supabase, content, file_path, bucket_name, debug=False): # Added debug flag
    """Upload file to Supabase Storage."""
    if supabase is None:
        return False

    filename = os.path.basename(file_path)
    if debug:
        logger.info("[DEBUG] Would upload %s to Supabase storage bucket %s", filename, bucket_name)
        return True # Simulate successful upload in debug mode

    try:
        response = supabase.storage.from_(bucket_name).upload(
            filename,
            content.encode('utf-8') if isinstance(content, str) else content,
            {"contentType": "text/plain"}
        )
        logger.info(f"Uploaded {filename} to Supabase storage bucket {bucket_name}")
        return True
    except Exception as e:
        logger.error(f"Failed to upload to Supabase: {e}")
        return False

def check_and_update_file(url, versions_data, versions_dir, supabase=None, bucket_name=None, debug=False): # Removed dynamic_patterns
    """
    Check if a file has changed and update if needed.
    Returns: change_detected (boolean)
    """
    filename = url.split('/')[-1].split('?')[0] # Clean query params for filename
    # Generate a more robust key, handling potential long URLs or query params better
    url_hash_part = hashlib.md5(url.encode('utf-8')).hexdigest()[:8] # Use part of URL hash for uniqueness
    url_key = f"{re.sub(r'[^a-zA-Z0-9_-]', '_', filename)}_{url_hash_part}"
    if len(url_key) > 150: # Keep key length reasonable
        url_key = url_key[:150]

    change_detected = False # Initialize change status

    if url_key not in versions_data:
        versions_data[url_key] = {
            "url": url,
            "filename": filename, # Store original filename for reference
            "versions": []
        }
    elif versions_data[url_key].get("url") != url:
        # Handle potential hash collision or key reuse - log warning
        logger.warning(f"URL key '{url_key}' maps to different URLs: '{versions_data[url_key].get('url')}' and '{url}'. Check key generation.")
        # Optionally, update the stored URL if this is considered the canonical one now
        versions_data[url_key]["url"] = url


    content = fetch_url(url)
    if content is None:
        return change_detected # Return only boolean

    content_hash = get_file_hash(content)

    # Check if content has changed
    versions = versions_data[url_key]["versions"]
    is_new_version = len(versions) == 0 or content_hash != versions[-1]["hash"]

    if is_new_version:
        change_detected = True # Mark change detected
        # Use year, month, day, hour format for the timestamp (24-hour format)
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S") # Added minutes and seconds for finer granularity
        version_id = f"v{timestamp}"
        # Use a cleaner version filename, removing potential query strings etc.
        clean_filename_base = re.sub(r'[^\w\.-]', '_', filename) # Replace non-alphanumeric chars (except . -) with _
        if not clean_filename_base: # Handle cases where filename is empty after cleaning (e.g., just '?')
            clean_filename_base = "file"
        version_filename_suffix = f"{version_id}-{clean_filename_base}.txt" # Suffix part
        # Combine url_key prefix and suffix, ensuring reasonable length
        max_suffix_len = 255 - len(url_key) - 1 # Max length for suffix part considering prefix and hyphen
        if len(version_filename_suffix) > max_suffix_len:
            # Shorten the clean_filename_base part if necessary
            base_len_to_keep = max_suffix_len - len(f"{version_id}-") - 4 # Keep space for .txt
            if base_len_to_keep < 5: base_len_to_keep = 5 # Minimum base name part
            clean_filename_base = clean_filename_base[:base_len_to_keep]
            version_filename_suffix = f"{version_id}-{clean_filename_base}.txt"

        version_filename = f"{url_key}-{version_filename_suffix}" # Ensure unique local filename

        version_path = versions_dir / version_filename

        logger.info(f"New version detected for {filename} ({url}): {version_id}")

        # Save the new version locally (conditionally)
        if debug:
            logger.info("[DEBUG] Would save new version locally to %s", version_path)
        else:
            try:
                with open(version_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                logger.info(f"Saved new version locally to {version_path}")
            except OSError as e:
                 logger.error(f"Error saving file {version_path}: {e}")
                 version_path = None # Indicate save failed

        # Upload to Supabase if available (conditionally)
        supabase_path = None
        if supabase and bucket_name:
            # Use a filename suitable for Supabase (e.g., based on url_key and version)
            # Use url_key as a "folder" and version_id + clean base as filename
            supabase_filename = f"{url_key}/{version_id}-{clean_filename_base}"
            # Limit total path length for Supabase if necessary (though less strict usually)
            if len(supabase_filename) > 300: # Example limit
                supabase_filename = supabase_filename[:300]

            # Pass debug flag to upload function
            if upload_to_supabase(supabase, content, supabase_filename, bucket_name, debug):
                supabase_path = f"{bucket_name}/{supabase_filename}" # Store potential path even in debug

        # Prepare version data (always prepare to show what would be added)
        new_version = {
            "id": version_id,
            "label": f"Version {len(versions) + 1} ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})", # Added seconds
            "timestamp": timestamp,
            "hash": content_hash,
            "path": str(version_path) if version_path else None # Store potential path even in debug, handle save failure
        }

        # Add Supabase path if available
        if supabase_path:
            new_version["supabase_path"] = supabase_path

        # Update versions data in memory (conditionally)
        if debug:
            logger.info("[DEBUG] Would add new version metadata: %s", new_version)
        else:
            # Ensure the versions list exists before appending
            if "versions" not in versions_data[url_key]:
                 versions_data[url_key]["versions"] = []
            versions_data[url_key]["versions"].append(new_version)
            logger.info("Added new version metadata.")

    return change_detected # Return only boolean

def main():
    """Main function to check files once."""
    # --- Argument Parsing ---
    parser = argparse.ArgumentParser(description="Check remote files for changes and store versions.")
    parser.add_argument("--debug", action="store_true", help="Run in debug mode (log actions without making changes, keep browser open).")
    parser.add_argument("--wait-time", type=int, default=10, help="Seconds to wait for Selenium page to load resources (default: 10).")
    # --- Corrected CAPTCHA-specific arguments ---
    # Renamed --solve-captchas to --bypass-captcha
    parser.add_argument("--bypass-captcha", action="store_true", help="Actively attempt to detect and bypass reCAPTCHA v2.")
    # Removed --captcha-type as only reCaptchaV2 is supported by pypasser 0.0.5
    # parser.add_argument("--captcha-type", choices=["auto", "recaptcha", "hcaptcha", "image"], default="auto",
    #                     help="Specify the CAPTCHA type to target (default: auto-detect).")
    # ---
    args = parser.parse_args()
    # --- End Argument Parsing ---

    if args.debug:
        # Ensure logger level is DEBUG if debug flag is set
        if logger.level > logging.DEBUG:
             logger.setLevel(logging.DEBUG)
        logger.info("--- RUNNING IN DEBUG MODE ---")
    else:
         # Ensure logger level is INFO if not in debug mode
         if logger.level != logging.INFO:
              logger.setLevel(logging.INFO)

    logger.info("Starting Feature Tracker file check")
    versions_dir = ensure_directories()

    # Load config, including Supabase settings and dynamic sources
    static_urls, supabase_config, dynamic_sources = load_config() # Get dynamic_sources

    # --- Initialize URL tracking sets ---
    urls_to_check = set(static_urls) # Start with static URLs
    checked_urls = set() # Keep track of checked URLs to avoid duplicates if Selenium finds overlap

    # Fetch initial dynamic URLs using Selenium
    selenium_discovered_urls = set()
    if dynamic_sources:
        for name, config in dynamic_sources.items():
            # --- Log the correct name and URL being processed ---
            logger.info(f"Processing dynamic source '{name}' ({config['url']}) via Selenium")
            # ---
            try:
                # --- Pass debug and bypass_captcha flags to fetch_dynamic_urls ---
                dynamic_urls_found = fetch_dynamic_urls(
                    config['url'],
                    config['pattern'],
                    args.wait_time,
                    args.debug,
                    args.bypass_captcha # Pass the flag here
                )
                # ---
                selenium_discovered_urls.update(dynamic_urls_found) # Add found URLs to the set
            except Exception as e:
                 # --- Log the correct name and URL in case of error ---
                logger.error(f"Failed to fetch or process dynamic source '{name}' ({config['url']}): {e}", exc_info=True)
                 # ---

    urls_to_check.update(selenium_discovered_urls) # Add Selenium-discovered URLs to the check queue

    if not urls_to_check:
        logger.warning("No URLs configured or found via Selenium. Add static URLs or check dynamic source config/patterns.")
        return

    logger.info(f"Total unique URLs to check (static + dynamic): {len(urls_to_check)}")

    versions_data = load_versions()
    any_change_detected_in_run = False # Track if any file changed during the whole run

    # Set up Supabase with config from file
    supabase = setup_supabase(supabase_config)

    # Get bucket name from config
    bucket_name = supabase_config.get('bucket', 'gemini-files')

    # --- Simplified Checking Loop (No more recursive discovery) ---
    processed_count = 0
    for current_url in urls_to_check:
        processed_count += 1
        # Basic URL validation (still useful)
        if not current_url.startswith(('http://', 'https://')):
            logger.warning(f"Skipping invalid or relative URL found: {current_url}")
            continue

        # Avoid re-checking if somehow duplicated (e.g., static + dynamic)
        if current_url in checked_urls:
             logger.debug(f"Skipping already processed URL: {current_url}")
             continue

        logger.info(f"Checking URL ({processed_count}/{len(urls_to_check)}): {current_url}")
        checked_urls.add(current_url) # Mark as checked

        try:
            # Call check_and_update_file (no longer returns newly_found_urls)
            change_detected = check_and_update_file(
                current_url, versions_data, versions_dir, supabase, bucket_name, args.debug
            )

            if change_detected:
                any_change_detected_in_run = True

        except Exception as e:
            logger.error(f"Error processing URL {current_url}: {e}", exc_info=True) # Log traceback for errors during check

    # --- End Simplified Checking Loop ---

    logger.info(f"Finished checking. Total unique URLs processed in this run: {len(checked_urls)}")

    if any_change_detected_in_run:
        # Pass debug flag to save_versions
        save_versions(versions_data, args.debug)
    else:
        logger.info("No changes detected in monitored files during this run")

    if args.debug:
        logger.info("--- DEBUG MODE FINISHED ---")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Process interrupted by user")
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
