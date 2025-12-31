"""
Web utility functions for downloading and fetching remote resources.
"""
import os
import requests


def download_pdf(url: str, local_path: str, timeout: int = 60) -> bool:
    """
    Downloads a PDF from a remote URL and saves it locally.
    
    Args:
        url: The remote URL to download from
        local_path: The local file path to save to
        timeout: Request timeout in seconds (default 60)
    
    Returns:
        True if successful, False otherwise
    """
    try:
        print(f"📥 Downloading PDF from: {url}")
        response = requests.get(url, timeout=timeout, stream=True)
        response.raise_for_status()
        
        # Ensure the directory exists
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        # Write the file in chunks
        with open(local_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        print(f"✅ Downloaded and saved to: {local_path}")
        return True
        
    except requests.exceptions.Timeout:
        print(f"❌ Download timed out: {url}")
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to download PDF: {e}")
        return False
    except IOError as e:
        print(f"❌ Failed to save PDF: {e}")
        return False

