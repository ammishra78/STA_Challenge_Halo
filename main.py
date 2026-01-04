# -*- coding: utf-8 -*-
"""
=============================================================================
ANESTHESIA DEVICE ASSISTANT - BACKEND SERVER
=============================================================================

This is the main backend file for the Anesthesia Device Assistant application.
It provides a web server that:
1. Serves the frontend webpage to users
2. Analyzes uploaded images of medical devices using AI (OpenAI's GPT-4o-mini)
3. Extracts manufacturer and model information from device labels
4. Provides a chat interface for users to ask questions about device manuals

TECHNOLOGY USED:
- FastAPI: A modern Python web framework for building APIs
- OpenAI API: For image analysis and text generation
- Pydantic: For data validation

HOW IT WORKS:
1. User uploads a photo of a medical device
2. The image is sent to OpenAI's vision model
3. The AI extracts manufacturer and model information with confidence scores
4. User confirms or corrects the information
5. User can then ask questions about the device manual

=============================================================================
"""

# =============================================================================
# IMPORTS - Loading required libraries/tools
# =============================================================================

# FastAPI: The web framework we use to create our server and handle web requests
from fastapi import FastAPI, UploadFile, File
# HTMLResponse: Allows us to send HTML web pages back to the browser
from fastapi.responses import HTMLResponse
# StaticFiles: Serves static files (like JavaScript, CSS) to the browser
from fastapi.staticfiles import StaticFiles
# BaseModel: Used to define the structure of data we expect from requests
from pydantic import BaseModel
# Optional: Allows a variable to be either a value OR None (empty)
from typing import Optional, List
# base64: Converts images to text format so they can be sent to the AI
# requests: Allows us to make HTTP calls to external APIs (like OpenAI)
# os: Provides functions for interacting with the operating system (files, folders)
# json: Handles conversion between Python objects and JSON text format
import base64, requests, os, json

# Device database: Contains all known devices and their manual info
from device_database import get_manufacturers as db_get_manufacturers, get_models as db_get_models
# RAG module: Handles all manual-based Q&A (fetching, indexing, querying)
from rag import ask_question


# =============================================================================
# APPLICATION SETUP
# =============================================================================

# Create the FastAPI application instance
# This is the main "app" that handles all web requests
app = FastAPI()

# Mount the "static" folder to serve frontend files (HTML, CSS, JavaScript)
# When someone requests "/static/script.js", it will serve the file from the "static" folder
app.mount("/static", StaticFiles(directory="static"), name="static")

# Mount the manual_images folder to serve extracted PDF images
# Creates the directory if it doesn't exist
import os
os.makedirs("manual_images", exist_ok=True)
app.mount("/manual_images", StaticFiles(directory="manual_images"), name="manual_images")

# Mount the manuals folder to allow PDF viewing/download
os.makedirs("manuals", exist_ok=True)
app.mount("/manuals", StaticFiles(directory="manuals"), name="manuals")


# =============================================================================
# CONFIGURATION - Settings that control how the app behaves
# =============================================================================

# OpenAI API Key - Loaded lazily from environment variable for security
# Users must set OPENAI_API_KEY environment variable before running the server
_openai_key = None

def get_openai_key():
    """Lazily get the OpenAI API key from environment variable."""
    global _openai_key
    if _openai_key is None:
        _openai_key = os.getenv("OPENAI_API_KEY")
        if not _openai_key:
            raise EnvironmentError(
                "OPENAI_API_KEY environment variable is not set. "
                "Please set it before making API calls.\n"
                "  Linux/macOS: export OPENAI_API_KEY='your-key'\n"
                "  Windows: $env:OPENAI_API_KEY = 'your-key'"
            )
    return _openai_key

# Maximum number of tokens (words/word-pieces) the AI can generate in its response
# Higher = more text but more expensive. 300 is enough for our JSON response.
MAX_OUTPUT_TOKENS = 300

# =============================================================================
# CONFIDENCE THRESHOLDS
# =============================================================================
# These values determine when we consider the AI's extraction "confident enough"
# A confidence score is a number from 0.0 to 1.0 (0% to 100%)
# 
# Example: If threshold is 0.6 (60%)
#   - Confidence of 0.8 (80%) = CONFIDENT (above threshold)
#   - Confidence of 0.4 (40%) = NOT CONFIDENT (below threshold)
#
# You can adjust these values to be stricter (higher) or more lenient (lower)
# They can also be set independently for manufacturer vs model if needed

CONFIDENCE_THRESHOLD = 0.6  # General threshold (not currently used, kept for reference)
MANUFACTURER_CONFIDENCE_THRESHOLD = 0.6  # 60% confidence needed for manufacturer
MODEL_NUMBER_CONFIDENCE_THRESHOLD = 0.6  # 60% confidence needed for model number

# Device matching threshold - used when AI suggests a similar device from our database
# Higher threshold = stricter matching, lower false positives
DEVICE_MATCH_CONFIDENCE_THRESHOLD = 0.7  # 70% confidence needed to suggest a device match


# =============================================================================
# AI PROMPT - Instructions we send to OpenAI to analyze the image
# =============================================================================
# This is a carefully crafted prompt that tells the AI exactly what to do
# and what format to return the results in (JSON format)

EXTRACTION_PROMPT = """Analyze this medical device image and extract device information.

Return ONLY a valid JSON object with these exact fields:
{
    "manufacturer": "<manufacturer name or null if not visible>",
    "model_number": "<model number/identifier or null if not readable>",
    "manufacturer_confidence": <float 0.0-1.0 indicating confidence in manufacturer identification>,
    "model_number_confidence": <float 0.0-1.0 indicating confidence in model number identification>,
    "error_code": "<ERROR_NONE if successful, ERROR_UNCLEAR_IMAGE if image is blurry/unreadable, ERROR_NO_DEVICE if no device visible, ERROR_PARTIAL_INFO if only some info readable>",
    "error_string": "<empty string if no error, otherwise brief description of the issue>",
    "suggestion": "<empty string if no error, otherwise actionable suggestion for the user>"
}

Rules:
- Return ONLY the JSON, no other text
- manufacturer_confidence: Rate 0.0-1.0 based on how clearly you can read/identify the manufacturer name
- model_number_confidence: Rate 0.0-1.0 based on how clearly you can read/identify the model number
- Each confidence score should be evaluated INDEPENDENTLY
- Set confidence below 0.6 if you're uncertain about that specific field
- model_number should contain alphanumeric identifiers (e.g., "8015", "B650", "AS50")
- If image is unclear, set appropriate error_code and provide helpful suggestion
- Be concise in error_string and suggestion fields"""


# =============================================================================
# API ENDPOINTS - The URLs that handle different requests
# =============================================================================

@app.get("/")
def home():
    """
    HOME PAGE ENDPOINT
    
    This is called when someone visits the main URL (e.g., http://localhost:8000/)
    It reads the HTML file and sends it to the user's browser.
    
    The "@app.get("/")" decorator tells FastAPI:
    - Listen for GET requests (normal page visits)
    - At the "/" URL (root/home page)
    """
    # Open and read the HTML file, then send it as a response
    # Use UTF-8 encoding explicitly for Windows compatibility
    with open("static/index.html", encoding="utf-8") as f:
        return HTMLResponse(f.read())


@app.post("/api/extract-model")
async def extract_model(image: UploadFile = File(...)):
    """
    IMAGE EXTRACTION ENDPOINT
    
    This endpoint receives an uploaded image of a medical device and uses
    OpenAI's vision AI to extract the manufacturer and model number.
    
    The "@app.post("/api/extract-model")" decorator tells FastAPI:
    - Listen for POST requests (data submissions)
    - At the "/api/extract-model" URL
    
    Parameters:
        image (UploadFile): The image file uploaded by the user
    
    Returns:
        dict: A JSON response containing:
            - manufacturer: The detected manufacturer name
            - model_number: The detected model number
            - manufacturer_confidence: How confident the AI is (0.0 to 1.0)
            - model_number_confidence: How confident the AI is (0.0 to 1.0)
            - manufacturer_confident: True if confidence meets threshold
            - model_number_confident: True if confidence meets threshold
            - error_code: Any error that occurred
            - error_string: Human-readable error message
            - suggestion: Helpful suggestion for the user
            - image: Path where the image was saved
    
    Process:
        1. Save the uploaded image to the "uploads" folder
        2. Convert the image to base64 format (text representation)
        3. Send to OpenAI's API with our extraction prompt
        4. Parse the AI's response
        5. Evaluate confidence scores against thresholds
        6. Return structured response to frontend
    """
    
    # STEP 1: Create uploads folder if it doesn't exist
    # This is where we'll save user-uploaded images
    upload_folder = "uploads"
    os.makedirs(upload_folder, exist_ok=True)  # exist_ok=True prevents error if folder exists

    # STEP 2: Save the uploaded image to disk
    # We save it so we can:
    # a) Keep a record of what was uploaded
    # b) Read it back as bytes for the AI
    saved_path = os.path.join(upload_folder, image.filename)
    with open(saved_path, "wb") as buffer:  # "wb" = write binary (for images)
        buffer.write(await image.read())  # "await" because reading is asynchronous

    # STEP 3: Read the image back and convert to base64
    # Base64 is a way to encode binary data (like images) as text
    # This is required because the AI API expects images in this format
    with open(saved_path, "rb") as f:  # "rb" = read binary
        img_bytes = f.read()

    # Convert bytes to base64 text
    img_b64 = base64.b64encode(img_bytes).decode()

    # STEP 4: Prepare the request for OpenAI's API
    # This is the data we'll send to the AI
    payload = {
        "model": "gpt-4o-mini",  # The AI model to use (vision-capable)
        "max_output_tokens": MAX_OUTPUT_TOKENS,  # Limit response length
        "input": [
            {
                "role": "user",  # We're sending this as a user message
                "content": [
                    # First part: Our text instructions (the prompt)
                    {"type": "input_text", "text": EXTRACTION_PROMPT},
                    # Second part: The image to analyze
                    {"type": "input_image", "image_url": f"data:image/jpeg;base64,{img_b64}"}
                ]
            }
        ]
    }

    # Authentication header with our API key
    headers = {"Authorization": f"Bearer {get_openai_key()}"}

    # STEP 5: Prepare a default error response
    # This will be returned if anything goes wrong
    default_response = {
        "manufacturer": None,
        "model_number": None,
        "manufacturer_confidence": 0.0,
        "model_number_confidence": 0.0,
        "manufacturer_confidence_threshold": MANUFACTURER_CONFIDENCE_THRESHOLD,
        "model_number_confidence_threshold": MODEL_NUMBER_CONFIDENCE_THRESHOLD,
        "manufacturer_confident": False,
        "model_number_confident": False,
        "error_code": "ERROR_API_FAILURE",
        "error_string": "Failed to communicate with OpenAI API",
        "suggestion": "Please try again later or check your API key",
        "image": saved_path
    }

    # STEP 6: Call OpenAI's API and process the response
    try:
        # Send the request to OpenAI
        response = requests.post("https://api.openai.com/v1/responses", json=payload, headers=headers)
        result = response.json()  # Convert response to Python dictionary
        
        # Extract the text response from the nested structure
        # The response structure is: result["output"][0]["content"][0]["text"]
        raw_text = result["output"][0]["content"][0]["text"].strip()
        
        # STEP 7: Parse the JSON response from the AI
        # Sometimes the AI wraps JSON in markdown code blocks (```json ... ```)
        # We need to handle this case
        if raw_text.startswith("```"):
            # Remove the markdown wrapper
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]  # Remove "json" label
            raw_text = raw_text.strip()
        
        # Convert the JSON text to a Python dictionary
        extracted_data = json.loads(raw_text)
        
        # STEP 8: Extract and evaluate confidence scores
        # Get the confidence values (default to 0.0 if not present)
        manufacturer_confidence = float(extracted_data.get("manufacturer_confidence", 0.0))
        model_number_confidence = float(extracted_data.get("model_number_confidence", 0.0))
        manufacturer = extracted_data.get("manufacturer")
        model_number = extracted_data.get("model_number")
        
        # STEP 9: Determine if each field is "confident" (meets threshold)
        # A field is confident if:
        # 1. Its confidence score is >= the threshold
        # 2. The value is not None (empty)
        # 3. The value is not an empty string
        
        manufacturer_confident = (
            manufacturer_confidence >= MANUFACTURER_CONFIDENCE_THRESHOLD and
            manufacturer is not None and
            manufacturer != ""
        )
        
        model_number_confident = (
            model_number_confidence >= MODEL_NUMBER_CONFIDENCE_THRESHOLD and
            model_number is not None and
            model_number != ""
        )
        
        # STEP 10: Build the final response to send back to the frontend
        api_response = {
            "manufacturer": manufacturer,
            "model_number": model_number,
            "manufacturer_confidence": manufacturer_confidence,
            "model_number_confidence": model_number_confidence,
            "manufacturer_confidence_threshold": MANUFACTURER_CONFIDENCE_THRESHOLD,
            "model_number_confidence_threshold": MODEL_NUMBER_CONFIDENCE_THRESHOLD,
            "manufacturer_confident": manufacturer_confident,
            "model_number_confident": model_number_confident,
            "error_code": extracted_data.get("error_code", "ERROR_NONE"),
            "error_string": extracted_data.get("error_string", ""),
            "suggestion": extracted_data.get("suggestion", ""),
            "image": saved_path
        }
        
        # Log the result for debugging (will appear in terminal)
        # The 📋 emoji makes it easy to spot in the logs
        print(f"📋 Extraction result: {json.dumps(api_response, indent=2)}")
        
        return api_response
    
    # ERROR HANDLING
    # Different types of errors are caught and handled separately
    
    except json.JSONDecodeError as e:
        # The AI returned something that isn't valid JSON
        print(f"❌ JSON parsing failed: {e}")
        print(f"Raw response: {raw_text if 'raw_text' in locals() else 'N/A'}")
        default_response["error_code"] = "ERROR_PARSE_FAILURE"
        default_response["error_string"] = "Could not parse AI response as JSON"
        default_response["suggestion"] = "The AI returned an unexpected format. Please try with a clearer image."
        return default_response
        
    except KeyError as e:
        # The API response didn't have the expected structure
        print(f"❌ Response structure error: {e}")
        print(f"API result: {result if 'result' in locals() else 'N/A'}")
        default_response["error_code"] = "ERROR_API_RESPONSE"
        default_response["error_string"] = f"Unexpected API response structure: {e}"
        default_response["suggestion"] = "Please try again or contact support if the issue persists."
        return default_response
        
    except Exception as e:
        # Any other unexpected error
        print(f"❌ Unexpected error: {e}")
        default_response["error_string"] = str(e)
        return default_response


# =============================================================================
# DATA MODELS - Defining the structure of expected data
# =============================================================================

class ChatMessage(BaseModel):
    """
    Represents a single message in the chat history.
    
    Fields:
        role (str): Either "user" or "assistant"
        content (str): The message text
    """
    role: str
    content: str


class ChatRequest(BaseModel):
    """
    Defines the structure of data expected when a user sends a chat message.
    
    Pydantic's BaseModel automatically validates incoming data and provides
    helpful error messages if the data doesn't match the expected format.
    
    Fields:
        manufacturer (str, optional): The device manufacturer
        model (str): The device model number (required)
        question (str): The user's question about the device (required)
        history (list, optional): Previous conversation messages for context
    """
    manufacturer: Optional[str] = None  # Optional = can be None/missing
    model: str  # Required
    question: str  # Required
    history: Optional[List[ChatMessage]] = None  # Chat history for follow-up questions


# =============================================================================
# MORE API ENDPOINTS
# =============================================================================

@app.get("/api/manufacturers")
def api_get_manufacturers():
    """
    GET ALL MANUFACTURERS ENDPOINT
    
    Returns a list of all manufacturer names in our database.
    This is used to populate the manufacturer dropdown in the frontend.
    
    URL: GET /api/manufacturers
    
    Returns:
        dict: {"manufacturers": ["BD Alaris", "GE Healthcare", ...]}
    """
    return {"manufacturers": db_get_manufacturers()}


@app.get("/api/device-types")
def api_get_device_types():
    """
    GET DEVICE TYPES ENDPOINT
    
    Returns a list of all supported device types.
    
    URL: GET /api/device-types
    
    Returns:
        dict: {"device_types": ["Anesthesia Machine", "Infusion Pump", ...]}
    """
    from device_database import get_device_types
    return {"device_types": get_device_types()}


@app.get("/api/devices-by-type")
def api_get_devices_by_type():
    """
    GET ALL DEVICES GROUPED BY TYPE ENDPOINT
    
    Returns all devices grouped by their device type.
    Used for the Devices tab display.
    
    URL: GET /api/devices-by-type
    
    Returns:
        dict: {
            "Anesthesia Machine": [
                {"manufacturer": "Dräger", "model": "Apollo", "has_manual": true},
                ...
            ],
            "Infusion Pump": [...],
            ...
        }
    """
    from device_database import get_all_devices_grouped_by_type
    import os
    
    grouped = get_all_devices_grouped_by_type()
    
    # Add has_manual flag based on local file existence
    result = {}
    for device_type, devices in grouped.items():
        result[device_type] = []
        for device in devices:
            local_path = device.get("local")
            has_manual = local_path and os.path.exists(local_path)
            result[device_type].append({
                "manufacturer": device["manufacturer"],
                "model": device["model"],
                "has_manual": has_manual
            })
    
    return result


@app.get("/api/models/{manufacturer}")
def api_get_models(manufacturer: str):
    """
    GET MODELS FOR A MANUFACTURER ENDPOINT
    
    Returns a list of all model numbers for a specific manufacturer.
    This is used to populate the model dropdown after a manufacturer is selected.
    
    URL: GET /api/models/{manufacturer}
    Example: GET /api/models/Baxter → {"models": ["AS50", "A50"]}
    
    Parameters:
        manufacturer (str): The manufacturer name (from the URL path)
    
    Returns:
        dict: {"models": ["model1", "model2", ...]}
        or: {"models": [], "error": "..."} if manufacturer not found
    """
    models = db_get_models(manufacturer)
    if not models:
        return {"models": [], "error": f"Manufacturer '{manufacturer}' not found"}
    return {"models": models}


@app.get("/api/check-manual/{manufacturer}/{model}")
def check_manual(manufacturer: str, model: str):
    """
    CHECK MANUAL AVAILABILITY ENDPOINT
    
    Checks if we have a manual/documentation available for a specific device.
    Called when the user confirms their device selection to show appropriate messaging.
    
    URL: GET /api/check-manual/{manufacturer}/{model}
    Example: GET /api/check-manual/Dräger/A100
    
    Returns:
        dict: {
            "has_manual": True/False,
            "manual_name": "...",  (if available)
            "device_name": "Manufacturer Model",
            "device_type": "Anesthesia Machine" (if available),
            "pdf_url": "/manuals/..." (if available)
        }
    """
    from device_database import get_model_info
    
    device_name = f"{manufacturer} {model}".strip() if manufacturer else model
    
    # Check if we have documentation for this device
    model_info = get_model_info(manufacturer, model)
    
    if model_info:
        local_path = model_info.get("local")
        device_type = model_info.get("type")
        
        # Only consider manual as available if local file EXISTS
        # (RAG requires local files - remote URLs alone are not sufficient)
        if local_path and os.path.exists(local_path):
            manual_name = os.path.basename(local_path)
            # Create a URL for viewing/downloading the PDF
            pdf_url = f"/{local_path}"  # e.g., "/manuals/Atlan_A_Series_User_Guide.pdf"
            return {
                "has_manual": True,
                "manual_name": manual_name,
                "device_name": device_name,
                "device_type": device_type,
                "pdf_url": pdf_url,
                "local_path": local_path
            }
        
        # Manual not available but we have device info (including type)
        return {
            "has_manual": False,
            "device_name": device_name,
            "device_type": device_type
        }
    
    # No device found in database at all
    return {
        "has_manual": False,
        "device_name": device_name,
        "device_type": None
    }


# =============================================================================
# DEVICE MATCHING ENDPOINT - Find closest device when exact match fails
# =============================================================================

def get_all_devices_list() -> list:
    """
    Returns a flat list of all devices in the database for AI matching.
    Format: ["Manufacturer: Model", ...]
    """
    from device_database import DEVICE_DATABASE
    devices = []
    for manufacturer, data in DEVICE_DATABASE.items():
        for model in data["models"].keys():
            devices.append(f"{manufacturer}: {model}")
    return devices


def match_device_with_ai(input_manufacturer: str, input_model: str) -> dict:
    """
    Uses ChatGPT to find the closest matching device from our database.
    
    This function is called when the user's device doesn't exactly match
    any device in our database. It asks the AI to find the best match.
    
    Parameters:
        input_manufacturer: The manufacturer name provided by the user
        input_model: The model name provided by the user
    
    Returns:
        dict: {
            "suggested_manufacturer": str or None,
            "suggested_model": str or None,
            "confidence": float (0.0-1.0),
            "reasoning": str
        }
    """
    print(f"\n🔍 AI DEVICE MATCHING: Input = '{input_manufacturer}' / '{input_model}'")
    
    # Get all devices from our database
    all_devices = get_all_devices_list()
    devices_list = "\n".join([f"- {device}" for device in all_devices])
    
    print(f"📋 Searching against {len(all_devices)} devices in database")
    
    # Construct the user's input
    user_input = f"{input_manufacturer} {input_model}".strip()
    
    # Create the prompt for AI matching
    prompt = f"""You are a device matching assistant. A user has provided a device name that doesn't exactly match our database.

USER INPUT: "{user_input}"

OUR SUPPORTED DEVICES:
{devices_list}

Your task:
1. Find the BEST matching device from our list based on the user input
2. Consider variations like:
   - Abbreviated names (e.g., "A100" might mean "Atlan A100")
   - Spelling variations (e.g., "Drager" = "Dräger")
   - Missing product line names (e.g., "A350" might mean "Atlan A350")
   - Similar model numbers
3. Provide a confidence score (0.0 to 1.0) for your match
4. If no reasonable match exists, set confidence to 0.0

Respond ONLY with valid JSON in this exact format:
{{
    "suggested_manufacturer": "Exact manufacturer name from the list or null",
    "suggested_model": "Exact model name from the list or null",
    "confidence": 0.85,
    "reasoning": "Brief explanation of why this is a match"
}}

IMPORTANT:
- suggested_manufacturer and suggested_model must EXACTLY match entries from the list above
- confidence should be 0.0 if there's no reasonable match
- confidence should be 0.9+ only for very clear matches (e.g., "Drager A100" → "Dräger Atlan A100")
- confidence should be 0.7-0.9 for likely matches with some uncertainty
- confidence should be below 0.7 for weak/uncertain matches"""

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {get_openai_key()}"
    }
    
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are a precise device matching assistant. Always respond with valid JSON only."},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 300,
        "temperature": 0.1  # Low temperature for consistent matching
    }
    
    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=15
        )
        response.raise_for_status()
        
        result = response.json()
        content = result["choices"][0]["message"]["content"].strip()
        
        print(f"🤖 ChatGPT Raw Response: {content}")
        
        # Parse the JSON response (handle markdown-wrapped JSON)
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1])
        
        match_data = json.loads(content)
        
        print(f"✅ Parsed Match: {match_data.get('suggested_manufacturer')} / {match_data.get('suggested_model')} (confidence: {match_data.get('confidence')})")
        
        return {
            "suggested_manufacturer": match_data.get("suggested_manufacturer"),
            "suggested_model": match_data.get("suggested_model"),
            "confidence": float(match_data.get("confidence", 0.0)),
            "reasoning": match_data.get("reasoning", "")
        }
        
    except Exception as e:
        print(f"❌ Device matching error: {e}")
        return {
            "suggested_manufacturer": None,
            "suggested_model": None,
            "confidence": 0.0,
            "reasoning": f"Error during matching: {str(e)}"
        }


@app.post("/api/match-device")
def match_device(request: dict):
    """
    DEVICE MATCHING ENDPOINT
    
    Attempts to match the user's device input to our database.
    First tries exact match, then falls back to AI-assisted matching.
    
    Request Body:
        {
            "manufacturer": "Drager",
            "model": "A100"
        }
    
    Response:
        {
            "exact_match": true/false,
            "manufacturer": "Dräger",      (matched or original)
            "model": "Atlan A100",         (matched or original)
            "device_type": "Anesthesia Machine", (if found)
            "suggested": false,            (true if AI suggestion)
            "confidence": 0.85,            (AI confidence, 1.0 for exact)
            "meets_threshold": true/false,
            "threshold": 0.7,
            "message": "..." 
        }
    """
    from device_database import DEVICE_DATABASE, get_model_docs, get_model_info
    
    input_manufacturer = request.get("manufacturer", "").strip()
    input_model = request.get("model", "").strip()
    
    print(f"\n{'='*60}")
    print(f"🔎 MATCH-DEVICE API CALLED")
    print(f"   Manufacturer: '{input_manufacturer}'")
    print(f"   Model: '{input_model}'")
    print(f"{'='*60}")
    
    # Step 1: Try exact match
    docs = get_model_docs(input_manufacturer, input_model)
    
    if docs:
        # Exact match found
        print(f"✅ EXACT MATCH FOUND - proceeding with original values")
        model_info = get_model_info(input_manufacturer, input_model)
        device_type = model_info.get("type") if model_info else None
        return {
            "exact_match": True,
            "manufacturer": input_manufacturer,
            "model": input_model,
            "device_type": device_type,
            "suggested": False,
            "confidence": 1.0,
            "meets_threshold": True,
            "threshold": DEVICE_MATCH_CONFIDENCE_THRESHOLD,
            "message": "Device found in database."
        }
    
    # Step 2: Try case-insensitive and partial matching before AI
    print(f"🔄 Step 2: Trying case-insensitive matching...")
    for mfr_name, mfr_data in DEVICE_DATABASE.items():
        # Check manufacturer similarity (case-insensitive, handle umlauts)
        mfr_lower = mfr_name.lower().replace("ä", "a").replace("ö", "o").replace("ü", "u")
        input_mfr_lower = input_manufacturer.lower().replace("ä", "a").replace("ö", "o").replace("ü", "u")
        
        if mfr_lower == input_mfr_lower or input_mfr_lower in mfr_lower or mfr_lower in input_mfr_lower:
            print(f"   Manufacturer match: '{mfr_name}' matches input '{input_manufacturer}'")
            # Manufacturer matches, check models
            for model_name in mfr_data["models"].keys():
                model_lower = model_name.lower()
                input_model_lower = input_model.lower()
                
                # Exact model match (case-insensitive)
                if model_lower == input_model_lower:
                    print(f"✅ CASE-INSENSITIVE MATCH: {mfr_name} / {model_name}")
                    model_info = get_model_info(mfr_name, model_name)
                    device_type = model_info.get("type") if model_info else None
                    return {
                        "exact_match": True,
                        "manufacturer": mfr_name,
                        "model": model_name,
                        "device_type": device_type,
                        "suggested": False,
                        "confidence": 1.0,
                        "meets_threshold": True,
                        "threshold": DEVICE_MATCH_CONFIDENCE_THRESHOLD,
                        "message": "Device found in database."
                    }
    
    # Step 3: Use AI to find the best match
    print(f"🤖 Step 3: No match found, calling AI for similarity matching...")
    ai_match = match_device_with_ai(input_manufacturer, input_model)
    
    suggested_manufacturer = ai_match.get("suggested_manufacturer")
    suggested_model = ai_match.get("suggested_model")
    confidence = ai_match.get("confidence", 0.0)
    reasoning = ai_match.get("reasoning", "")
    
    meets_threshold = confidence >= DEVICE_MATCH_CONFIDENCE_THRESHOLD
    
    if suggested_manufacturer and suggested_model and meets_threshold:
        # AI found a good match - get device type
        model_info = get_model_info(suggested_manufacturer, suggested_model)
        device_type = model_info.get("type") if model_info else None
        return {
            "exact_match": False,
            "manufacturer": suggested_manufacturer,
            "model": suggested_model,
            "device_type": device_type,
            "suggested": True,
            "confidence": confidence,
            "meets_threshold": True,
            "threshold": DEVICE_MATCH_CONFIDENCE_THRESHOLD,
            "reasoning": reasoning,
            "message": f"Did you mean {suggested_manufacturer} {suggested_model}?"
        }
    elif suggested_manufacturer and suggested_model:
        # AI found a match but below threshold
        model_info = get_model_info(suggested_manufacturer, suggested_model)
        device_type = model_info.get("type") if model_info else None
        return {
            "exact_match": False,
            "manufacturer": suggested_manufacturer,
            "model": suggested_model,
            "device_type": device_type,
            "suggested": True,
            "confidence": confidence,
            "meets_threshold": False,
            "threshold": DEVICE_MATCH_CONFIDENCE_THRESHOLD,
            "reasoning": reasoning,
            "message": "We were unable to determine the device you are referring to based on the currently supported platforms."
        }
    else:
        # No match found
        return {
            "exact_match": False,
            "manufacturer": input_manufacturer,
            "model": input_model,
            "device_type": None,
            "suggested": False,
            "confidence": 0.0,
            "meets_threshold": False,
            "threshold": DEVICE_MATCH_CONFIDENCE_THRESHOLD,
            "message": "We were unable to determine the device you are referring to based on the currently supported platforms."
        }


def web_search_fallback(manufacturer: str, model: str, question: str) -> dict:
    """
    FALLBACK: Web-based search using ChatGPT when no manual is available.
    
    This function uses OpenAI's GPT model to provide information about a device
    based on publicly available internet knowledge. The response clearly indicates
    that the information is NOT from an official manual.
    
    Parameters:
        manufacturer: The device manufacturer name
        model: The device model number
        question: The user's question
    
    Returns:
        dict with answer, sources disclaimer, and fallback flag
    """
    device_name = f"{manufacturer} {model}".strip() if manufacturer else model
    
    # Craft a prompt that asks for web-based information with source awareness
    prompt = f"""You are helping a user find information about a medical device: {device_name}

The user's question is: {question}

IMPORTANT INSTRUCTIONS:
1. Answer based on your general knowledge about this device from publicly available sources
2. Be helpful but cautious - this is medical equipment
3. At the end of your response, suggest 2-3 specific resources where the user might find official documentation:
   - Manufacturer's official website
   - FDA database (if applicable)
   - Medical equipment databases
4. Keep your answer concise but informative
5. If you're uncertain about specific technical details, clearly state that

Remember: Your response will be clearly labeled as coming from internet sources, NOT an official manual."""

    try:
        # Call OpenAI API for web-based knowledge
        payload = {
            "model": "gpt-4o-mini",
            "max_output_tokens": 800,
            "input": [
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": prompt}
                    ]
                }
            ]
        }
        
        headers = {"Authorization": f"Bearer {get_openai_key()}"}
        response = requests.post("https://api.openai.com/v1/responses", json=payload, headers=headers)
        result = response.json()
        
        # Extract the answer text
        answer_text = result["output"][0]["content"][0]["text"].strip()
        
        return {
            "success": True,
            "answer": answer_text,
            "device_name": device_name
        }
        
    except Exception as e:
        print(f"❌ Web search fallback failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@app.post("/api/chat")
def chat(req: ChatRequest):
    """
    CHAT ENDPOINT
    
    Handles user questions about a device's manual.
    Uses our RAG (Retrieval-Augmented Generation) system to find
    relevant information in the PDF manual and generate an answer.
    Supports follow-up questions via chat history.
    
    FALLBACK BEHAVIOR:
    If no manual is found for the device, the system will attempt to
    provide information from public internet sources via ChatGPT.
    The response clearly indicates when fallback mode is used.
    
    URL: POST /api/chat
    Body: {
        "manufacturer": "Baxter",
        "model": "AS50",
        "question": "How do I...",
        "history": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
    }
    
    Parameters:
        req (ChatRequest): The validated request data containing:
            - manufacturer: The device manufacturer
            - model: The device model number
            - question: The user's question
            - history: Previous conversation for context (optional)
    
    Returns:
        dict: {
            "answer": "...",
            "error": False,
            "sources": [{"text": "...", "score": 0.85, "page": "142"}, ...],
            "confidence": 0.87,
            "is_fallback": False  # True if using web search instead of manual
        }
        or: {"answer": None, "error": True, "message": "..."} if complete failure
    """
    # Convert history to list of dicts for RAG module
    history = None
    if req.history:
        history = [{"role": msg.role, "content": msg.content} for msg in req.history]
    
    # Call RAG module - it handles everything (finding manual, downloading, indexing, answering)
    result = ask_question(req.manufacturer or "", req.model, req.question, history)
    
    # If RAG succeeded, return the official manual-based answer
    if not result["error"]:
        return {
            "answer": result["answer"],
            "error": False,
            "sources": result["sources"],
            "confidence": result["confidence"],
            "images": result.get("images", []),
            "is_fallback": False
        }
    
    # ==========================================================================
    # FALLBACK: No manual found - try web-based search
    # ==========================================================================
    print(f"📡 No manual found, attempting web search fallback for {req.manufacturer} {req.model}")
    
    fallback_result = web_search_fallback(req.manufacturer or "", req.model, req.question)
    
    if fallback_result["success"]:
        # Return fallback response (disclaimer already shown when device was confirmed)
        return {
            "answer": fallback_result["answer"],
            "error": False,
            "is_fallback": True,
            "sources": [],
            "confidence": 0,
            "images": []
        }
    
    # Complete failure - neither manual nor fallback worked
    return {
        "answer": None,
        "error": True,
        "message": f"No manual found for {req.manufacturer} {req.model}, and web search also failed. Please try again later.",
        "sources": [],
        "confidence": 0,
        "is_fallback": False
    }
