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

# --- Simplified Logging Setup ---
# Get the specific logger instance
logger = logging.getLogger('feature_tracker')
# Set default level (will be overridden by --debug if needed)
logger.setLevel(logging.INFO)
# Prevent propagating to root logger if basicConfig was called elsewhere
logger.propagate = False
# Remove existing handlers to avoid duplicates if script is re-run in same process
if logger.hasHandlers():
    logger.handlers.clear()
# Create a handler and formatter
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
# Add the handler to the logger
logger.addHandler(handler)
# --- End Simplified Logging Setup ---


# --- Remove Old basicConfig and init logger ---
# logging.basicConfig(
#     level=logging.INFO,
#     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
#     handlers=[logging.StreamHandler()]
# )
# logger = logging.getLogger('feature_tracker_init') # Use a temp logger name initially
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

# --- Remove Selenium-Wire Import ---
# try:
#     from seleniumwire import webdriver as webdriver_wire # Use seleniumwire's webdriver
#     SELENIUM_WIRE_AVAILABLE = True
# except ImportError as e: # Catch the specific error
#     logger.error(f"Failed to import 'seleniumwire': {e}. Please install it.")
#     SELENIUM_WIRE_AVAILABLE = False
#     missing_packages.append("selenium-wire")
# ---

# --- Remove undetected-chromedriver Import ---
# try:
#     import undetected_chromedriver as uc
#     UNDETECTED_CHROMEDRIVER_AVAILABLE = True
# except ImportError as e:
#     logger.error(f"Failed to import 'undetected_chromedriver': {e}. Please install it.")
#     UNDETECTED_CHROMEDRIVER_AVAILABLE = False
#     missing_packages.append("undetected-chromedriver")
# ---

# --- Add SeleniumBase Import ---
try:
    # from seleniumbase import SB # Import the SB context manager
    from seleniumbase import Driver # Import the Driver class
    SELENIUMBASE_AVAILABLE = True
except ImportError as e:
    logger.error(f"Failed to import 'seleniumbase': {e}. Please install it.")
    SELENIUMBASE_AVAILABLE = False
    missing_packages.append("seleniumbase")
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

# If any required packages are missing, exit with instructions
if missing_packages:
    print("ERROR: Missing required packages. Please install them with:")
    print(f"pip install {' '.join(missing_packages)}")
    print("\nAlternatively, use requirements.txt:")
    print("pip install -r requirements.txt")
    sys.exit(1)

# --- Remove logger reassignment ---
# logger = logging.getLogger('feature_tracker') # Update logger name
# ---

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
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            in_supabase_section = False
            in_dynamic_section = False

            logger.debug("--- Starting config file parsing ---")
            for i, line_raw in enumerate(f):
                line = line_raw.strip()
                logger.debug(f"Line {i+1}: Raw='{line_raw.rstrip()}', Stripped='{line}'")

                if not line or line.startswith('#'):
                    logger.debug(f"Line {i+1}: Skipping comment or empty line.")
                    continue

                # --- Refined Logic V3 ---
                # 1. Check for specific, known section headers FIRST
                if line == '[supabase]':
                    logger.debug(f"Line {i+1}: Entering [supabase] section.")
                    in_supabase_section = True
                    in_dynamic_section = False
                    continue
                elif line == '[dynamic_sources]':
                    logger.debug(f"Line {i+1}: Entering [dynamic_sources] section.")
                    in_supabase_section = False
                    in_dynamic_section = True
                    continue
                # Treat any other line starting with '[' as an unknown/ignored section ONLY if we are NOT already in a section.
                elif line.startswith('[') and not in_supabase_section and not in_dynamic_section:
                     logger.debug(f"Line {i+1}: Ignoring unknown section header '{line}' (not currently in a known section).")
                     # Ensure flags remain False
                     in_supabase_section = False
                     in_dynamic_section = False
                     continue

                # 2. If it wasn't a section header, process based on current section flag
                if in_supabase_section:
                    logger.debug(f"Line {i+1}: Processing in [supabase] section.")
                    if '=' in line:
                        key, value = line.split('=', 1)
                        if key in supabase_config:
                            supabase_config[key] = value
                            logger.debug(f"Line {i+1}: Set supabase config '{key}'.")
                    else:
                       logger.debug(f"Line {i+1}: Ignoring line in [supabase] (no '=').")
                    # No continue here, fall through handled by section flag

                elif in_dynamic_section:
                    logger.debug(f"Line {i+1}: Processing in [dynamic_sources] section.")
                    # Now, lines like [captcha]key=value are processed here
                    if '=' in line:
                        key, value_part = line.split('=', 1)
                        key = key.strip()
                        value_part = value_part.strip()
                        logger.debug(f"Line {i+1}: Split into key='{key}', value_part='{value_part}'.")

                        check_captcha = False
                        # Check for [captcha] prefix on the key part
                        if key.lower().startswith("[captcha]"):
                            check_captcha = True
                            key = key[len("[captcha]"):].strip() # Remove flag from key
                            logger.debug(f"Line {i+1}: Found [captcha] flag, new key='{key}'.")

                        if not key:
                            logger.warning(f"Dynamic source line {i+1} missing name after [captcha] flag: '{line}'. Skipping.")
                        elif ',' in value_part:
                            source_url, pattern = value_part.split(',', 1)
                            dynamic_sources[key] = {
                                'url': source_url.strip(),
                                'pattern': pattern.strip(),
                                'check_captcha': check_captcha
                            }
                            logger.debug(f"Line {i+1}: Added dynamic source '{key}' with URL='{dynamic_sources[key]['url']}', Pattern='{dynamic_sources[key]['pattern']}', Captcha={check_captcha}.")
                        else:
                            logger.warning(f"Invalid format for dynamic source line {i+1}: '{line}'. Expected '[captcha]name=url,pattern' or 'name=url,pattern'. Missing comma? Skipping.")
                    else:
                        logger.warning(f"Ignoring line {i+1} in [dynamic_sources] section without '=': '{line}'")
                    # No continue here, fall through handled by section flag

                # 3. If NOT in a section and it wasn't a section header, treat as static URL
                elif not in_supabase_section and not in_dynamic_section:
                    logger.debug(f"Line {i+1}: Processing as static URL.")
                    urls.append(line)
                # --- End Refined Logic V3 ---

            logger.debug("--- Finished config file parsing ---")

        logger.info(f"Loaded {len(urls)} static URLs from config file")
        if supabase_config['url'] and supabase_config['key']:
            logger.info("Loaded Supabase configuration")
        if dynamic_sources:
             logger.info(f"Loaded {len(dynamic_sources)} dynamic URL sources from config file")
             logger.debug(f"Final dynamic_sources: {dynamic_sources}") # DEBUG

        return urls, supabase_config, dynamic_sources
    except FileNotFoundError:
        logger.error(f"Config file not found at {CONFIG_PATH}")
        # Create example config
        # ... (example config writing remains the same) ...
        logger.info(f"Created example config file at {CONFIG_PATH}")
        return [], supabase_config, {}

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
        # Use a common user agent to potentially avoid simple blocks
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        response = requests.get(url, timeout=30, headers=headers)
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        logger.error(f"Error fetching {url}: {e}")
        return None

def fetch_dynamic_urls(source_url, pattern, check_for_captcha, wait_time=10, debug=False): # Added check_for_captcha param
    """
    Fetch a source URL using SeleniumBase Driver with UC mode,
    extract URLs from page content/resources based on the pattern.
    Optionally checks for CAPTCHA and pauses if check_for_captcha is True.
    Runs headlessly if check_for_captcha is False.
    """
    if not SELENIUMBASE_AVAILABLE:
        logger.error("SeleniumBase Driver is not available. Cannot fetch dynamic URLs.")
        return []

    logger.info(f"Fetching dynamic URLs from {source_url} matching pattern '{pattern}' using SeleniumBase Driver (UC Mode)")
    found_urls = set()
    driver = None # Initialize driver to None

    try:
        # --- Setup SeleniumBase Driver with UC Mode ---
        # --- Conditionally set headless mode ---
        run_headless = not check_for_captcha
        driver_args = {
            "uc": True,
            "headless": run_headless, # Set based on captcha check
            "browser": "chrome",
        }
        if run_headless:
            logger.info("Running SeleniumBase Driver headlessly (no captcha check).")
        else:
            logger.info("Running SeleniumBase Driver with visible browser (captcha check enabled).")
        # ---

        # --- Instantiate Driver directly ---
        driver = Driver(**driver_args)
        # ---

        # Note: set_page_load_timeout might need to be applied differently or may be implicitly handled.
        # Let's try without it first, or use driver.set_page_load_timeout() if needed after instantiation.
        # driver.set_page_load_timeout(60) # Standard Selenium method might work

        logger.info("SeleniumBase Driver initialized successfully in UC mode.")

        logger.info(f"Navigating to {source_url}...")
        # Use driver.get() or driver.uc_open methods
        # driver.get(source_url) # Standard get
        driver.uc_open_with_reconnect(source_url, reconnect_time=2) # Use UC specific open method
        logger.info(f"Page {source_url} loaded.")

        # --- Conditionally check for CAPTCHA and Pause ---
        if check_for_captcha:
            logger.info("Captcha check enabled for this source.")
            captcha_wait = 5
            logger.debug(f"Waiting {captcha_wait} seconds before checking for CAPTCHA...")
            time.sleep(captcha_wait)

            captcha_detected = False
            captcha_check_timeout = 5
            try:
                # Check for reCAPTCHA iframe
                if driver.is_element_present("iframe[title*='reCAPTCHA']", by="css selector", timeout=captcha_check_timeout):
                     captcha_detected = True
                     logger.info("Detected reCAPTCHA iframe.")
                # Check for Cloudflare Turnstile iframe
                elif driver.is_element_present("iframe[title='Widget containing a Cloudflare security challenge']", by="css selector", timeout=captcha_check_timeout):
                     captcha_detected = True
                     logger.info("Detected Cloudflare Turnstile iframe.")
                # Check for common text indicators (adjust text as needed)
                elif driver.is_text_present("verify you are human", timeout=1) or \
                     driver.is_text_present("security check", timeout=1):
                     captcha_detected = True
                     logger.info("Detected CAPTCHA text indicator.")
                # Add more specific element checks if the above fail
                # elif driver.is_element_present("#turnstile-wrapper", timeout=1): # Example for a div ID
                #      captcha_detected = True
                #      logger.info("Detected specific CAPTCHA element ID.")

            except Exception as find_e:
                logger.debug(f"Error checking for CAPTCHA elements: {find_e}")

            # --- Add page source logging in debug if CAPTCHA not detected ---
            if not captcha_detected and debug:
                 try:
                      logger.debug("CAPTCHA not detected by standard checks. Logging page source for manual inspection:")
                      # Limit source length to avoid huge logs
                      page_src = driver.page_source
                      logger.debug(page_src[:5000] + ("..." if len(page_src) > 5000 else ""))
                 except Exception as ps_e:
                      logger.warning(f"Could not get page source for debugging: {ps_e}")
            # ---

            if captcha_detected:
                logger.warning("CAPTCHA detected on the page.")
                # Always try the automated click first if detected
                try:
                    logger.info("Attempting automated CAPTCHA click using driver.uc_gui_click_captcha()...")
                    # This method auto-detects reCAPTCHA/Turnstile and attempts the click
                    driver.uc_gui_click_captcha()
                    logger.info("Automated CAPTCHA click attempted. Waiting 5s...")
                    time.sleep(5) # Wait a bit after the click attempt
                except Exception as gui_e:
                    logger.warning(f"Automated CAPTCHA click failed (may need manual interaction): {gui_e}")

                # If in debug mode, pause for manual intervention regardless of click success,
                # as the image/audio challenge might still need solving.
                # --- Input prompt moved outside this block ---
                # if debug:
                #    input("DEBUG MODE: CAPTCHA detected. Please solve it in the browser, then press Enter here to continue...")
                #    logger.info("Continuing after manual CAPTCHA intervention.")
                # else:
                #    logger.warning("CAPTCHA detected but running in non-debug mode. Proceeding after automated click attempt...")
            else:
                logger.info("No obvious CAPTCHA indicators detected by current checks.")
            # ---

            # --- Always pause after CAPTCHA check/attempt ---
            input(f"Paused after loading {source_url}. Check browser (solve CAPTCHA if present), then press Enter here to continue...")
            logger.info("Continuing after manual check/intervention.")
            # ---
        else:
            logger.info("Captcha check disabled for this source (running headlessly).") # Updated message
        # --- End Conditional CAPTCHA Check ---

        # Wait for page activity/potential dynamic content loading
        logger.info(f"Waiting {wait_time} seconds for page activity...")
        time.sleep(wait_time) # driver.sleep(wait_time) also works

        # --- Capture URLs from Page Content/Resources ---
        logger.info("Extracting URLs from page content and resources...")
        page_source = driver.page_source

        # Direct regex search in the page source
        clean_pattern = pattern.replace('https://', '').replace('http://', '')
        url_pattern_str = r'(https?://[^"\'\s<>]+' + re.escape(clean_pattern) + r'[^"\'\s<>]*)'
        url_pattern = re.compile(url_pattern_str)
        matches = url_pattern.findall(page_source)

        for url in matches:
            if url.startswith(('http://', 'https://')):
                logger.debug(f"Adding URL matching pattern from page content: '{url}'")
                found_urls.add(url)

        # Also check network resources using JavaScript
        try:
            # Use driver.execute_script
            js_resources = driver.execute_script("""
                let resources = [];
                try {
                    performance.getEntriesByType('resource').forEach(r => resources.push(r.name));
                } catch (e) { }
                return resources;
            """)
            for url in js_resources:
                if clean_pattern in url and url.startswith(('http://', 'https://')):
                    logger.debug(f"Adding URL matching pattern from performance resources: '{url}'")
                    found_urls.add(url)
        except Exception as e:
            logger.warning(f"Error getting performance resources via JS: {e}")
        # --- End URL Capture ---

        if not found_urls:
            logger.warning(f"No URLs containing pattern '{pattern}' were found after loading {source_url}.")
        else:
            logger.info(f"Found {len(found_urls)} URLs matching pattern '{pattern}' at {source_url}")

        return list(found_urls)

    except Exception as e:
        logger.error(f"Error during SeleniumBase Driver fetch for {source_url}: {e}", exc_info=True)
        return []
    finally:
        # --- Manually quit driver only if NOT in debug mode ---
        if driver and not debug:
            logger.info("Closing SeleniumBase browser.")
            driver.quit()
        # --- Keep browser open in debug mode ONLY if it was visible ---
        elif driver and debug and not run_headless:
             logger.info("Debug mode: Keeping visible SeleniumBase browser open.")
        elif driver and debug and run_headless:
             logger.info("Debug mode: Headless browser was used, quitting anyway.")
             driver.quit() # Quit even in debug if it was headless
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
    original_filename = url.split('/')[-1].split('?')[0] # Keep original filename with extension
    # Generate a more robust key, handling potential long URLs or query params better
    url_hash_part = hashlib.md5(url.encode('utf-8')).hexdigest()[:8] # Use part of URL hash for uniqueness
    # Sanitize original filename slightly differently for the key if needed, or use the same sanitized one
    sanitized_key_filename = re.sub(r'[^a-zA-Z0-9_-]', '_', original_filename)
    url_key = f"{sanitized_key_filename}_{url_hash_part}"
    if len(url_key) > 150: # Keep key length reasonable
        url_key = url_key[:150]

    change_detected = False # Initialize change status

    if url_key not in versions_data:
        versions_data[url_key] = {
            "url": url,
            "filename": original_filename, # Store original filename for reference
            "versions": []
        }
    elif versions_data[url_key].get("url") != url:
        # Handle potential hash collision or key reuse - log warning
        logger.warning(f"URL key '{url_key}' maps to different URLs: '{versions_data[url_key].get('url')}' and '{url}'. Check key generation.")
        # Optionally, update the stored URL if this is considered the canonical one now
        versions_data[url_key]["url"] = url
        versions_data[url_key]["filename"] = original_filename # Update filename too


    content = fetch_url(url)
    if content is None:
        return change_detected # Return only boolean

    content_hash = get_file_hash(content)

    # Check if content has changed
    versions = versions_data[url_key]["versions"]
    is_new_version = len(versions) == 0 or content_hash != versions[-1]["hash"]

    if is_new_version:
        change_detected = True # Mark change detected
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S") # Use consistent timestamp format
        version_id_suffix = f"-v{timestamp}.txt" # Suffix including version and extension

        # Sanitize the original filename for use in the actual file path
        # Keep '.' and '-' allowed in filenames
        sanitized_original_filename = re.sub(r'[^\w\.-]', '_', original_filename)
        if not sanitized_original_filename: # Handle empty sanitized name
            sanitized_original_filename = "file"

        # --- New Filename Construction ---
        # Combine url_key prefix, sanitized original name, and version suffix
        # Ensure reasonable total length (e.g., 255 for path component)
        max_len_for_parts = 255
        max_sanitized_name_len = max_len_for_parts - len(url_key) - 1 - len(version_id_suffix)

        if max_sanitized_name_len < 1: # Ensure there's at least some space for the name
             # This case is unlikely but handles extreme url_key/suffix lengths
             logger.warning(f"Cannot construct valid filename for {original_filename} due to length constraints. Using fallback.")
             sanitized_original_filename = "file" # Fallback base name
             max_sanitized_name_len = max_len_for_parts - len(url_key) - 1 - len(version_id_suffix)
             if max_sanitized_name_len < 1: max_sanitized_name_len = 1 # Minimal length
             sanitized_original_filename = sanitized_original_filename[:max_sanitized_name_len]

        elif len(sanitized_original_filename) > max_sanitized_name_len:
            # Shorten the sanitized original filename part if it's too long
            sanitized_original_filename = sanitized_original_filename[:max_sanitized_name_len]

        # Final local filename
        version_filename = f"{url_key}-{sanitized_original_filename}{version_id_suffix}"
        # --- End New Filename Construction ---

        version_path = versions_dir / version_filename

        logger.info(f"New version detected for {original_filename} ({url}): v{timestamp}") # Log original name

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
            # Use a consistent naming for Supabase, using url_key as a "folder"
            # Use the same base filename part as the local file for consistency
            supabase_base_filename = f"{sanitized_original_filename}{version_id_suffix}"
            supabase_filename = f"{url_key}/{supabase_base_filename}"

            # Apply Supabase length limits if necessary (adjust limit as needed)
            max_supabase_path_len = 300
            if len(supabase_filename) > max_supabase_path_len:
                 # Shorten the base filename part if the whole path is too long
                 overflow = len(supabase_filename) - max_supabase_path_len
                 if len(supabase_base_filename) > overflow + 5: # Check if shortening is feasible
                     supabase_base_filename = supabase_base_filename[:len(supabase_base_filename) - overflow]
                     supabase_filename = f"{url_key}/{supabase_base_filename}"
                 else:
                     # Fallback if shortening isn't enough
                     logger.warning(f"Supabase path too long even after shortening: {supabase_filename}")
                     supabase_filename = f"{url_key}/file{version_id_suffix}" # Use fallback

            # Pass debug flag to upload function
            if upload_to_supabase(supabase, content, supabase_filename, bucket_name, debug):
                supabase_path = f"{bucket_name}/{supabase_filename}" # Store potential path even in debug

        # Prepare version data (always prepare to show what would be added)
        new_version = {
            "id": f"v{timestamp}", # Use v+timestamp as ID
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
    parser.add_argument("--debug", action="store_true", help="Run in debug mode (log actions without making changes, keep browser open, pause for manual CAPTCHA).")
    parser.add_argument("--wait-time", type=int, default=10, help="Seconds to wait for Selenium page to load resources (default: 10).")
    args = parser.parse_args()
    # --- End Argument Parsing ---

    # --- Adjust logger level immediately based on debug flag ---
    if args.debug:
        # Ensure logger level is DEBUG if debug flag is set
        logger.setLevel(logging.DEBUG) # Directly set the level on our logger instance
        logger.info("--- RUNNING IN DEBUG MODE (Logger set to DEBUG) ---")
    else:
         # Ensure logger level is INFO if not in debug mode
         logger.setLevel(logging.INFO) # Directly set the level
    # --- Logger level set ---

    logger.info("Starting Feature Tracker file check")
    versions_dir = ensure_directories()

    # Load config, including Supabase settings and dynamic sources
    static_urls, supabase_config, dynamic_sources = load_config() # Get dynamic_sources

    # --- Initialize URL tracking sets ---
    urls_to_check = set(static_urls) # Start with static URLs
    checked_urls = set() # Keep track of checked URLs to avoid duplicates if Selenium finds overlap

    # Fetch initial dynamic URLs using SeleniumBase
    selenium_discovered_urls = set()
    if dynamic_sources:
        for name, config in dynamic_sources.items():
            # --- Pass captcha check flag ---
            logger.info(f"Processing dynamic source '{name}' ({config['url']}) via SeleniumBase (Captcha Check: {config['check_captcha']})")
            try:
                dynamic_urls_found = fetch_dynamic_urls(
                    config['url'],
                    config['pattern'],
                    config['check_captcha'], # Pass the flag
                    args.wait_time,
                    args.debug
                )
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
