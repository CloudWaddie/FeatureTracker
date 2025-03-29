import os
import json
import hashlib
from datetime import datetime
from pathlib import Path
import logging
import sys

# Check for required packages and provide helpful error messages
missing_packages = []

try:
    import requests
except ImportError:
    missing_packages.append("requests")

# Import Supabase client
try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    missing_packages.append("supabase")

# If any required packages are missing, exit with instructions
if missing_packages:
    print("ERROR: Missing required packages. Please install them with:")
    print(f"pip install {' '.join(missing_packages)}")
    print("\nAlternatively, use requirements.txt:")
    print("pip install -r requirements.txt")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger('feature_tracker')

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
    """Load URLs and Supabase config from config file."""
    urls = []
    supabase_config = {
        'url': None,
        'key': None,
        'bucket': 'gemini-files'  # Default bucket name
    }
    
    try:
        with open(CONFIG_PATH, 'r') as f:
            in_supabase_section = False
            
            for line in f:
                line = line.strip()
                
                # Skip empty lines and comments
                if not line or line.startswith('#'):
                    continue
                
                # Check for section headers
                if line == '[supabase]':
                    in_supabase_section = True
                    continue
                
                # Parse Supabase config
                if in_supabase_section:
                    if '=' in line:
                        key, value = line.split('=', 1)
                        if key in supabase_config:
                            supabase_config[key] = value
                # Parse URLs (not in any section)
                elif not line.startswith('['):
                    urls.append(line)
        
        logger.info(f"Loaded {len(urls)} URLs from config file")
        if supabase_config['url'] and supabase_config['key']:
            logger.info("Loaded Supabase configuration")
        
        return urls, supabase_config
    except FileNotFoundError:
        logger.error(f"Config file not found at {CONFIG_PATH}")
        # Create example config
        with open(CONFIG_PATH, 'w') as f:
            f.write("# Add URLs to monitor, one per line\n")
            f.write("https://example.com/file1.txt\n")
            f.write("https://example.com/file2.json\n\n")
            f.write("# Supabase configuration\n")
            f.write("[supabase]\n")
            f.write("url=https://your-project-url.supabase.co\n")
            f.write("key=your-limited-permission-key-here\n")
            f.write("bucket=your-bucket-name\n")
        logger.info(f"Created example config file at {CONFIG_PATH}")
        return [], supabase_config

def load_versions():
    """Load existing versions data."""
    if VERSIONS_FILE.exists():
        with open(VERSIONS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_versions(versions_data):
    """Save versions data to JSON file."""
    with open(VERSIONS_FILE, 'w') as f:
        json.dump(versions_data, f, indent=2)

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

def upload_to_supabase(supabase, content, file_path, bucket_name):
    """Upload file to Supabase Storage."""
    if supabase is None:
        return False
    
    try:
        filename = os.path.basename(file_path)
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

def check_and_update_file(url, versions_data, versions_dir, supabase=None, bucket_name=None):
    """Check if a file has changed and update if needed."""
    filename = url.split('/')[-1]
    url_key = url.replace('://', '_').replace('/', '_')
    
    if url_key not in versions_data:
        versions_data[url_key] = {
            "url": url,
            "filename": filename,
            "versions": []
        }
    
    content = fetch_url(url)
    if content is None:
        return False
    
    content_hash = get_file_hash(content)
    
    # Check if content has changed
    versions = versions_data[url_key]["versions"]
    is_new_version = len(versions) == 0 or content_hash != versions[-1]["hash"]
    
    if is_new_version:
        # Use year, month, day, hour format for the timestamp (24-hour format)
        timestamp = datetime.now().strftime("%Y%m%d%H")
        version_id = f"v{timestamp}"
        version_filename = f"{url_key}-{version_id}.txt"
        version_path = versions_dir / version_filename
        
        # Save the new version locally
        with open(version_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        # Upload to Supabase if available
        supabase_path = None
        if supabase and bucket_name:
            if upload_to_supabase(supabase, content, version_filename, bucket_name):
                supabase_path = f"{bucket_name}/{version_filename}"
        
        # Update versions data
        new_version = {
            "id": version_id,
            "label": f"Version {len(versions) + 1} ({datetime.now().strftime('%Y-%m-%d %H:%M')})",
            "timestamp": timestamp,
            "hash": content_hash,
            "path": str(version_path)
        }
        
        # Add Supabase path if available
        if supabase_path:
            new_version["supabase_path"] = supabase_path
            
        versions.append(new_version)
        
        logger.info(f"New version detected for {filename}: {version_id}")
        return True
    
    return False

def main():
    """Main function to check files once."""
    logger.info("Starting Feature Tracker file check")
    versions_dir = ensure_directories()
    
    # Load config, including Supabase settings
    urls, supabase_config = load_config()
    if not urls:
        logger.warning("No URLs configured. Add URLs to config.txt and run again.")
        return
    
    versions_data = load_versions()
    changes_detected = False
    
    # Set up Supabase with config from file
    supabase = setup_supabase(supabase_config)
    
    # Get bucket name from config
    bucket_name = supabase_config.get('bucket', 'gemini-files')
    
    for url in urls:
        if check_and_update_file(url, versions_data, versions_dir, supabase, bucket_name):
            changes_detected = True
    
    if changes_detected:
        save_versions(versions_data)
        logger.info("Updates saved to versions file")
    else:
        logger.info("No changes detected in monitored files")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Process interrupted by user")
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
