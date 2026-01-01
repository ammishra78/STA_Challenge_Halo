"""
PDF Image Extraction Utility

Extracts images from PDF files and creates an index for quick lookup.
"""
import os
import json
import fitz  # PyMuPDF
from typing import Dict, List, Optional


# Directory where extracted images are stored
IMAGES_DIR = "manual_images"


def extract_images_from_pdf(pdf_path: str, min_width: int = 100, min_height: int = 100) -> Dict:
    """
    Extracts images from a PDF and saves them to disk.
    
    Args:
        pdf_path: Path to the PDF file
        min_width: Minimum image width to extract (filters out tiny icons)
        min_height: Minimum image height to extract
    
    Returns:
        Dict mapping page numbers to list of image filenames
    """
    if not os.path.exists(pdf_path):
        print(f"❌ PDF not found: {pdf_path}")
        return {}
    
    # Create output directory based on PDF name
    pdf_name = os.path.splitext(os.path.basename(pdf_path))[0]
    output_dir = os.path.join(IMAGES_DIR, pdf_name)
    os.makedirs(output_dir, exist_ok=True)
    
    # Check if already extracted (index file exists)
    index_path = os.path.join(output_dir, "index.json")
    if os.path.exists(index_path):
        print(f"📁 Loading existing image index for {pdf_name}")
        with open(index_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    print(f"📸 Extracting images from {pdf_name}...")
    
    # Open PDF
    doc = fitz.open(pdf_path)
    page_images = {}
    image_count = 0
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        page_label = str(page_num + 1)  # 1-indexed for display
        
        # Get images on this page
        image_list = page.get_images(full=True)
        
        if not image_list:
            continue
        
        page_images[page_label] = []
        
        for img_index, img_info in enumerate(image_list):
            xref = img_info[0]  # Image reference number
            
            try:
                # Extract image
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                width = base_image.get("width", 0)
                height = base_image.get("height", 0)
                
                # Skip small images (icons, bullets, etc.)
                if width < min_width or height < min_height:
                    continue
                
                # Save image
                image_filename = f"page_{page_label}_img_{img_index}.{image_ext}"
                image_path = os.path.join(output_dir, image_filename)
                
                with open(image_path, "wb") as f:
                    f.write(image_bytes)
                
                page_images[page_label].append({
                    "filename": image_filename,
                    "width": width,
                    "height": height
                })
                image_count += 1
                
            except Exception as e:
                print(f"⚠️ Failed to extract image on page {page_label}: {e}")
                continue
        
        # Remove empty page entries
        if not page_images[page_label]:
            del page_images[page_label]
    
    doc.close()
    
    # Save index (use UTF-8 encoding for Windows compatibility)
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(page_images, f, indent=2)
    
    print(f"✅ Extracted {image_count} images from {len(page_images)} pages")
    return page_images


def get_images_for_pages(pdf_path: str, page_numbers: List[str]) -> List[Dict]:
    """
    Gets images for specific pages.
    
    Args:
        pdf_path: Path to the PDF file
        page_numbers: List of page numbers (as strings)
    
    Returns:
        List of image info dicts with 'url', 'page', 'width', 'height'
    """
    # Extract images if not already done
    page_images = extract_images_from_pdf(pdf_path)
    
    if not page_images:
        return []
    
    pdf_name = os.path.splitext(os.path.basename(pdf_path))[0]
    images = []
    
    for page in page_numbers:
        if page in page_images:
            for img in page_images[page]:
                images.append({
                    "url": f"/manual_images/{pdf_name}/{img['filename']}",
                    "page": page,
                    "width": img["width"],
                    "height": img["height"]
                })
    
    return images


def get_image_index(pdf_path: str) -> Dict:
    """
    Gets or creates the image index for a PDF.
    
    Args:
        pdf_path: Path to the PDF file
    
    Returns:
        Dict mapping page numbers to image info
    """
    return extract_images_from_pdf(pdf_path)

