# Anesthesia Device Assistant

A web application that helps users identify anesthesia machines from photos and chat with AI about device manuals. Built with FastAPI, OpenAI Vision API, and LlamaIndex RAG (Retrieval-Augmented Generation).

---

## Table of Contents

1. [Setup Instructions](#setup-instructions)
2. [Running the Application](#running-the-application)
3. [Project Architecture](#project-architecture)
4. [Code Flow Diagram](#code-flow-diagram)
5. [File Structure](#file-structure)
6. [RAG System Explained](#rag-system-explained)
7. [Prompt Engineering Journey](#prompt-engineering-journey)
8. [API Reference](#api-reference)
9. [Recent Updates](#recent-updates-december-2025)

---

## Setup Instructions

### Prerequisites

- Python 3.10+ installed
- An OpenAI API key (with GPT-4o-mini access)

### Step-by-Step Setup

#### Linux/macOS (Bash)

```bash
# 1. Navigate to the project directory
cd C:\path\to\STA-Challenge\anesthesia

# 2. Create a Python virtual environment
python3 -m venv venv

# 3. Activate the virtual environment
source venv/bin/activate

# 4. Install all dependencies
pip install -r requirements.txt

# 5. (Optional) Verify installation
pip list
```

#### Windows (PowerShell)

```powershell
# 1. Navigate to the project directory
cd C:\path\to\STA-Challenge\anesthesia

# 2. Create a Python virtual environment
python -m venv venv

# 3. Activate the virtual environment
.\venv\Scripts\Activate.ps1

# NOTE: If you get an execution policy error, run this first (as Administrator):
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 4. Install all dependencies
pip install -r requirements.txt

# 5. (Optional) Verify installation
pip list
```

### Quick Command Reference

| Task | Bash (Linux/macOS) | PowerShell (Windows) |
|------|-------------------|---------------------|
| Create venv | `python3 -m venv venv` | `python -m venv venv` |
| Activate venv | `source venv/bin/activate` | `.\venv\Scripts\Activate.ps1` |
| Deactivate venv | `deactivate` | `deactivate` |
| Set UTF-8 (Windows only) | N/A | `$env:PYTHONUTF8 = "1"` |
| Run server | `uvicorn main:app --reload` | `uvicorn main:app --reload` |
| Kill port 8000 | `lsof -ti:8000 \| xargs -r kill -9` | See PowerShell command above |

### Dependencies Explained

| Package | Purpose |
|---------|---------|
| `fastapi` | Web framework for building APIs |
| `uvicorn` | ASGI server to run FastAPI |
| `python-multipart` | Handle file uploads |
| `requests` | Make HTTP calls to OpenAI API |
| `pydantic` | Data validation |
| `llama-index` | Core RAG functionality |
| `llama-index-llms-openai` | OpenAI LLM integration |
| `llama-index-embeddings-openai` | OpenAI embeddings for vector search |
| `pymupdf` | Extract images from PDF files |

---

## Running the Application

#### Linux/macOS (Bash)

```bash
# Make sure you're in the project directory with venv activated
# 1. Navigate to the project directory
cd C:\path\to\STA-Challenge\anesthesia

source venv/bin/activate

# Start the web server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Windows (PowerShell)

```powershell
# Make sure you're in the project directory with venv activated
cd C:\path\to\STA-Challenge\anesthesia
.\venv\Scripts\Activate.ps1

# IMPORTANT: Set UTF-8 encoding to avoid Unicode errors
$env:PYTHONUTF8 = "1"

# Start the web server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

> **Note:** If you see `UnicodeDecodeError: 'charmap' codec can't decode byte...`, make sure to set the `PYTHONUTF8=1` environment variable before running the server.

Then open your browser to: **http://localhost:8000**

### Stopping the Server

Press `Ctrl+C` in the terminal.

#### If the port is stuck:

**Linux/macOS:**
```bash
lsof -ti:8000 | xargs -r kill -9
```

**Windows (PowerShell - Run as Administrator):**
```powershell
# Find the process using port 8000
Get-NetTCPConnection -LocalPort 8000 | Select-Object -Property OwningProcess

# Kill the process (replace <PID> with the process ID from above)
Stop-Process -Id <PID> -Force

# Or as a one-liner:
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

---

## Project Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         index.html                                   │    │
│  │  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────────┐   │    │
│  │  │ Image Upload│  │ Device Selection │  │     Chat Interface    │   │    │
│  │  │   (Step 1)  │  │     (Step 2)     │  │       (Step 3)        │   │    │
│  │  └─────────────┘  └──────────────────┘  └───────────────────────┘   │    │
│  │                          ↓                          ↓               │    │
│  │                      script.js                                      │    │
│  │            (JavaScript: handles all UI logic)                       │    │
│  └──────────────────────────────│───────────────────────│──────────────┘    │
└─────────────────────────────────│───────────────────────│───────────────────┘
                                  │                       │
                    HTTP POST     │                       │  HTTP POST
                 /api/extract-model                   /api/chat
                                  │                       │
                                  ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FastAPI SERVER                                    │
│                              main.py                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          API ENDPOINTS                                  │ │
│  │                                                                         │ │
│  │  GET /                    → Serve index.html                            │ │
│  │  GET /api/manufacturers   → Return list of manufacturers                │ │
│  │  GET /api/models/{mfr}    → Return models for a manufacturer            │ │
│  │  POST /api/extract-model  → Analyze image with OpenAI Vision           │ │
│  │  POST /api/chat           → Answer questions using RAG                  │ │
│  │                                                                         │ │
│  └─────────────────────────────────│───────────────────────────────────────┘ │
│                                    │                                         │
│               ┌────────────────────┴────────────────────┐                   │
│               │                                         │                    │
│               ▼                                         ▼                    │
│  ┌────────────────────────┐               ┌────────────────────────┐        │
│  │   device_database.py   │               │        rag.py          │        │
│  │                        │               │                        │        │
│  │ • DEVICE_DATABASE dict │               │ • Load/create index    │        │
│  │ • get_manufacturers()  │               │ • Retrieve chunks      │        │
│  │ • get_models()         │◄──────────────│ • Generate answers     │        │
│  │ • get_model_docs()     │               │ • Extract sources      │        │
│  └────────────────────────┘               └───────────┬────────────┘        │
│                                                       │                      │
│                                     ┌─────────────────┴──────────────────┐  │
│                                     │                                    │   │
│                                     ▼                                    ▼   │
│                        ┌────────────────────────┐    ┌──────────────────────┐│
│                        │  utils/web_utils.py    │    │  utils/pdf_images.py ││
│                        │                        │    │                      ││
│                        │ • download_pdf()       │    │ • extract_images()   ││
│                        │   from remote URL      │    │ • get_images_for_    ││
│                        │                        │    │   pages()            ││
│                        └────────────────────────┘    └──────────────────────┘│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │  HTTP (API calls)
                                    ▼
                        ┌───────────────────────┐
                        │     OpenAI API        │
                        │                       │
                        │  • GPT-4o-mini        │
                        │  • Vision analysis    │
                        │  • Text generation    │
                        │  • Embeddings         │
                        └───────────────────────┘
```

---

## Code Flow Diagram

### Flow 1: Image Upload & Device Identification

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        IMAGE UPLOAD FLOW                                      │
└──────────────────────────────────────────────────────────────────────────────┘

User                    Frontend                    Backend                 OpenAI
 │                     (script.js)                 (main.py)                  │
 │                         │                          │                       │
 │  1. Select image        │                          │                       │
 │─────────────────────────►                          │                       │
 │                         │                          │                       │
 │                         │  2. POST /api/extract-   │                       │
 │                         │     model (FormData)     │                       │
 │                         │─────────────────────────►│                       │
 │                         │                          │                       │
 │                         │                          │  3. Convert to base64 │
 │                         │                          │     + Send to Vision  │
 │                         │                          │     API               │
 │                         │                          │──────────────────────►│
 │                         │                          │                       │
 │                         │                          │  4. JSON response:    │
 │                         │                          │     manufacturer,     │
 │                         │                          │     model_number,     │
 │                         │                          │     confidences       │
 │                         │                          │◄──────────────────────│
 │                         │                          │                       │
 │                         │  5. Return extraction    │                       │
 │                         │     result               │                       │
 │                         │◄─────────────────────────│                       │
 │                         │                          │                       │
 │  6. Show device         │                          │                       │
 │     selection UI        │                          │                       │
 │◄────────────────────────│                          │                       │
 │                         │                          │                       │
```

### Flow 2: Chat with Manual (RAG)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           RAG CHAT FLOW                                       │
└──────────────────────────────────────────────────────────────────────────────┘

User                  Frontend              Backend                    rag.py
 │                   (script.js)           (main.py)                     │
 │                       │                    │                          │
 │  1. Type question     │                    │                          │
 │───────────────────────►                    │                          │
 │                       │                    │                          │
 │                       │  2. POST /api/chat │                          │
 │                       │  {manufacturer,    │                          │
 │                       │   model, question, │                          │
 │                       │   history}         │                          │
 │                       │───────────────────►│                          │
 │                       │                    │                          │
 │                       │                    │  3. ask_question()       │
 │                       │                    │─────────────────────────►│
 │                       │                    │                          │
 │                       │                    │     ┌────────────────────┤
 │                       │                    │     │ a. Get manual path │
 │                       │                    │     │ b. Download if     │
 │                       │                    │     │    needed          │
 │                       │                    │     │ c. Load/create     │
 │                       │                    │     │    vector index    │
 │                       │                    │     │ d. Retrieve top 3  │
 │                       │                    │     │    relevant chunks │
 │                       │                    │     │ e. Build prompt    │
 │                       │                    │     │    with context    │
 │                       │                    │     │ f. Call OpenAI LLM │
 │                       │                    │     │ g. Extract sources │
 │                       │                    │     │    & images        │
 │                       │                    │     └────────────────────┤
 │                       │                    │                          │
 │                       │                    │  4. Return answer,       │
 │                       │                    │     sources, images      │
 │                       │                    │◄─────────────────────────│
 │                       │                    │                          │
 │                       │  5. Return JSON    │                          │
 │                       │◄───────────────────│                          │
 │                       │                    │                          │
 │  6. Display answer    │                    │                          │
 │     + sources +       │                    │                          │
 │     images (markdown) │                    │                          │
 │◄──────────────────────│                    │                          │
```

---

## File Structure

```
anesthesia/
├── main.py                 # FastAPI server - all API endpoints
├── rag.py                  # RAG logic - Q&A with manuals
├── device_database.py      # Device catalog (manufacturers, models, manual paths)
├── requirements.txt        # Python dependencies
├── README.md              # This documentation file
│
├── static/                 # Frontend files
│   ├── index.html         # Main HTML page with embedded CSS
│   ├── script.js          # Frontend JavaScript (state, API calls, UI)
│   ├── halo_transparent_zoomed.png  # Main Halo logo
│   ├── halo_device.png    # Device icon for chat
│   ├── halo_meet.png      # Icon for intro section
│   ├── halo_about.png     # Icon for About tab
│   ├── halo_safety.png    # Icon for Safety tab
│   └── halo_feedback.png  # Icon for Feedback tab
│
├── utils/                  # Utility modules
│   ├── __init__.py
│   ├── web_utils.py       # PDF download from URLs
│   └── pdf_images.py      # Image extraction from PDFs
│
├── manuals/               # PDF manual files
│   ├── Atlan_A_Series_User_Guide.pdf
│   ├── Fabius-GS-User-Manual.pdf
│   ├── 05-Drager-Apollo-Anesthesia-Machine-Manual.pdf
│   └── ...
│
├── uploads/               # User-uploaded images (temporary)
│
├── vector_indexes/        # Cached vector indexes for RAG
│   └── Atlan_A_Series_User_Guide/
│       ├── docstore.json
│       └── index_store.json
│
├── manual_images/         # Extracted images from PDFs
│   └── Atlan_A_Series_User_Guide/
│       ├── index.json
│       └── page_X_img_Y.png
│
└── venv/                  # Python virtual environment
```

---

## RAG System Explained

### What is RAG?

**RAG (Retrieval-Augmented Generation)** is a technique that enhances AI responses by first retrieving relevant information from a knowledge base, then using that information to generate accurate answers.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RAG PIPELINE                                        │
│                                                                              │
│  ┌──────────────┐    ┌──────────────────────┐    ┌───────────────────────┐  │
│  │   INDEXING   │    │     RETRIEVAL        │    │     GENERATION        │  │
│  │   (One-time) │    │   (Per question)     │    │   (Per question)      │  │
│  │              │    │                      │    │                       │  │
│  │  PDF Manual  │    │  User Question       │    │  Retrieved Context    │  │
│  │      ↓       │    │       ↓              │    │  + Question           │  │
│  │  Split into  │    │  Convert to          │    │       ↓               │  │
│  │  chunks      │    │  embedding vector    │    │  Send to LLM          │  │
│  │      ↓       │    │       ↓              │    │       ↓               │  │
│  │  Embed each  │    │  Find similar        │    │  Generated Answer     │  │
│  │  chunk       │    │  chunks (top 3)      │    │                       │  │
│  │      ↓       │    │                      │    │                       │  │
│  │  Store in    │    │                      │    │                       │  │
│  │  vector DB   │    │                      │    │                       │  │
│  └──────────────┘    └──────────────────────┘    └───────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### How `rag.py` Works (Step by Step)

#### 1. Configuration (Lines 20-33)

```python
# API key for OpenAI
OPENAI_API_KEY = "sk-proj-..."

# Initialize LLM (for text generation)
llm = OpenAI(model="gpt-4o-mini", api_key=OPENAI_API_KEY)

# Initialize embedding model (for vector search)
embed_model = OpenAIEmbedding(api_key=OPENAI_API_KEY)

# Set as global defaults
Settings.llm = llm
Settings.embed_model = embed_model
```

#### 2. Get Manual Path (Lines 36-65)

The `_get_manual_path()` function:
1. Looks up the device in `device_database.py`
2. Checks if local PDF exists
3. Downloads from remote URL if needed
4. Returns the local file path

```python
def _get_manual_path(manufacturer: str, model: str) -> Optional[str]:
    docs = get_model_docs(manufacturer, model)  # From device_database.py
    
    local_path = docs.get("local")   # e.g., "manuals/Atlan_A_Series.pdf"
    remote_url = docs.get("remote")  # e.g., "https://..."
    
    if os.path.exists(local_path):
        return local_path  # Use local copy
    
    if remote_url:
        download_pdf(remote_url, local_path)  # Download it
        return local_path
    
    return None  # No manual available
```

#### 3. Load or Create Vector Index (Lines 68-90)

The `_load_or_create_index()` function:

```python
def _load_or_create_index(pdf_path: str) -> VectorStoreIndex:
    manual_name = "Atlan_A_Series_User_Guide"  # From filename
    index_path = f"vector_indexes/{manual_name}"
    
    # OPTION A: Load existing index (fast, seconds)
    if os.path.exists(f"{index_path}/docstore.json"):
        storage = StorageContext.from_defaults(persist_dir=index_path)
        return load_index_from_storage(storage)
    
    # OPTION B: Create new index (slow, minutes)
    # This only happens once per PDF
    docs = SimpleDirectoryReader(input_files=[pdf_path]).load_data()
    index = VectorStoreIndex.from_documents(docs)
    index.storage_context.persist(persist_dir=index_path)
    return index
```

**What happens during indexing:**
1. PDF is split into chunks (~512 tokens each)
2. Each chunk is converted to a vector using OpenAI Embeddings
3. Vectors are stored in the index for fast similarity search

#### 4. Ask Question - Main Entry Point (Lines 93-241)

```python
def ask_question(manufacturer, model, question, history=None):
    # Step 1: Get manual path
    manual_path = _get_manual_path(manufacturer, model)
    
    # Step 2: Load vector index
    index = _load_or_create_index(manual_path)
    
    # Step 3: Retrieve relevant chunks (ONLY using current question)
    retriever = index.as_retriever(similarity_top_k=3)
    retrieved_nodes = retriever.retrieve(question)  # Find top 3 matches
    
    # Step 4: Build context from retrieved chunks
    context_str = "\n\n".join([node.node.text for node in retrieved_nodes])
    
    # Step 5: Build prompt WITH history (if provided)
    if history:
        # Include previous conversation for context
        full_prompt = f"""
        Device Manual Information:
        {context_str}
        
        Previous Conversation:
        {history_str}
        
        Current Question: {question}
        
        Answer based on manual. Use history ONLY if directly relevant.
        """
    else:
        full_prompt = f"""
        Device Manual Information:
        {context_str}
        
        Question: {question}
        """
    
    # Step 6: Generate answer with LLM
    response_text = llm.complete(full_prompt)
    
    # Step 7: Extract source metadata (page numbers, scores)
    sources = []
    for node in retrieved_nodes:
        sources.append({
            "text": node.node.text[:500],
            "score": node.score,
            "page": node.node.metadata.get("page_label")
        })
    
    # Step 8: Get images from source pages
    images = get_images_for_pages(manual_path, [s["page"] for s in sources])
    
    return {
        "answer": response_text,
        "sources": sources,
        "confidence": avg_score,
        "images": images
    }
```

### Key RAG Design Decisions

| Decision | Why |
|----------|-----|
| **Retrieve with current question only** | Prevents finding irrelevant chunks when follow-up questions change topic |
| **Include history in final prompt** | Allows LLM to understand context for genuine follow-ups |
| **Top 3 chunks** | Balance between context and token cost |
| **Persist indexes** | Avoid re-indexing (expensive) on every question |
| **Truncate sources to 500 chars** | Keep response size manageable |

---

## Prompt Engineering Journey

### Version 1: Simple Extraction (Initial)

```text
Please extract the manufacturer and model number from this medical device image.
```

**Problem:** Response was unstructured, often a full sentence:
```
"I can see this appears to be a Dräger machine but I can't read the model number clearly..."
```

---

### Version 2: JSON Format Request

```text
Analyze this image and return a JSON object with:
- manufacturer
- model_number
```

**Problem:** AI sometimes wrapped JSON in markdown or added extra text:
```
Here's what I found:
```json
{"manufacturer": "Dräger", "model_number": "A100"}
```
```

**Solution added:** Strip markdown wrapper in Python:
```python
if raw_text.startswith("```"):
    raw_text = raw_text.split("```")[1]
    if raw_text.startswith("json"):
        raw_text = raw_text[4:]
```

---

### Version 3: Error Handling

```text
Return a JSON with:
- manufacturer
- model_number  
- error_code: ERROR_NONE, ERROR_UNCLEAR_IMAGE, ERROR_NO_DEVICE, ERROR_PARTIAL_INFO
- error_string
- suggestion
```

**Improvement:** Now we could tell the user *why* extraction failed and what to do.

---

### Version 4: Confidence Scores (Current)

```text
Return a JSON with:
- manufacturer
- model_number
- manufacturer_confidence (0.0-1.0)
- model_number_confidence (0.0-1.0)
- error_code
- error_string
- suggestion

Rules:
- Each confidence score should be evaluated INDEPENDENTLY
- Set confidence below 0.6 if uncertain about that specific field
```

**Key improvements:**
1. **Separate confidence scores** - Manufacturer might be clear, model blurry
2. **Independent evaluation** - Each field judged on its own merit
3. **Threshold comparison** - Backend determines what's "confident enough"

---

### RAG Prompt Evolution

#### Version 1: Basic

```text
Question: {question}
Context: {retrieved_chunks}
```

**Problem:** Model hallucinated when chunks weren't relevant.

---

#### Version 2: With History

```text
Conversation History:
{history}

Device Manual Information:
{retrieved_chunks}

Question: {question}
```

**Problem:** When asking unrelated follow-up questions, retrieval used history to find wrong chunks.

---

#### Version 3: Smart Context (Current)

```text
Device Manual Information:
{retrieved_chunks}

Previous Conversation:
{history}

Current Question: {question}

IMPORTANT: Answer based on the manual information above.
- If this is a follow-up question, use conversation history for context.
- If this is a NEW TOPIC unrelated to previous conversation, ignore the history.
```

**Key insight:** Retrieve ONLY using current question, but include history in the prompt for the LLM to decide relevance.

---

## API Reference

### `GET /`
Returns the main HTML page.

### `GET /api/manufacturers`
Returns list of all manufacturers.
```json
{"manufacturers": ["BD Alaris", "Dräger", "GE Healthcare", ...]}
```

### `GET /api/models/{manufacturer}`
Returns models for a manufacturer.
```json
{"models": ["A100", "A300", "A350"]}
```

### `POST /api/extract-model`
Analyzes an uploaded image.

**Request:** `multipart/form-data` with `image` field

**Response:**
```json
{
  "manufacturer": "Dräger",
  "model_number": "A100",
  "manufacturer_confidence": 0.95,
  "model_number_confidence": 0.87,
  "manufacturer_confident": true,
  "model_number_confident": true,
  "error_code": "ERROR_NONE",
  "error_string": "",
  "suggestion": "",
  "image": "uploads/image.png"
}
```

### `POST /api/chat`
Asks a question about a device manual.

**Request:**
```json
{
  "manufacturer": "Dräger",
  "model": "A100",
  "question": "How do I perform the system test?",
  "history": [
    {"role": "user", "content": "previous question"},
    {"role": "assistant", "content": "previous answer"}
  ]
}
```

**Response (with manual):**
```json
{
  "answer": "To perform the system test...",
  "error": false,
  "sources": [
    {"text": "...excerpt...", "score": 0.89, "page": "142"}
  ],
  "confidence": 0.87,
  "images": [
    {"url": "/manual_images/...", "page": "142", "width": 800, "height": 600}
  ]
}
```

**Response (fallback - no manual):**
```json
{
  "answer": "Based on publicly available information...",
  "error": false,
  "is_fallback": true,
  "fallback_warning": true,
  "sources": [],
  "confidence": 0
}
```

### `GET /api/check-manual/{manufacturer}/{model}`
Checks if a manual is available for a device.

**Response:**
```json
{
  "has_manual": true,
  "device_name": "Dräger A100"
}
```

---

## Recent Updates (December 2025)

### UI/UX Improvements

#### Halo Branding
- Custom logo (`halo_transparent_zoomed.png`) in header
- Pulsating SVG animation for visual feedback
- "Ask Halo" chat interface with device-specific icons
- Gradient color scheme (teal to cyan)

#### Tabbed Navigation
The app now features a tabbed interface:
| Tab | Description |
|-----|-------------|
| **Ask Halo** | Main chat interface for device Q&A |
| **Devices** | List of supported devices grouped by manufacturer |
| **Safety** | Information about confidence scores and data privacy |
| **Feedback** | Submit feedback to improve Halo |
| **About** | Information about the development team |

#### Device Selection from Devices Tab
Users can click on any device in the Devices tab to:
1. Auto-switch to "Ask Halo" tab
2. Pre-populate the manufacturer/model dropdowns
3. Start chatting immediately after confirmation

### Device Detection States

The extraction UI now handles three distinct states:

| State | Title | Color | Behavior |
|-------|-------|-------|----------|
| **Full Detection** | 🎯 Device Detected | Green | Shows confirm/edit buttons |
| **Partial Match** | ⚠️ Partial Match | Orange | Auto-opens edit mode for missing field |
| **Not Found** | ❌ Device Not Found | Red | Auto-opens edit mode for both fields |

**Detection threshold:** 30% minimum confidence to consider a field "detected"

### Confidence Score Display

Confidence scores now display prominently in a two-column grid:

```
┌─────────────────────────┬─────────────────────────┐
│ MANUFACTURER            │ MODEL                   │
│ Dräger                  │ Atlan A350              │
│ Confidence: [85%]       │ Confidence: [72%]       │
│           (green badge) │           (orange badge)│
└─────────────────────────┴─────────────────────────┘
```

Color coding:
- **Green (80%+):** High confidence
- **Orange (60-79%):** Medium confidence
- **Red (<60%):** Low confidence

### State Machine Improvements

#### Image Upload Reset
Every new image upload now properly resets:
- Previous device confirmation
- Detection view (restores original grid layout)
- Extraction title and subtitle
- Chat history and notifications

#### Edit Device from Chat
The "Edit" button in the chat header now:
1. Re-enables all disabled dropdowns
2. Resets the confirm button
3. Hides the chat section
4. Scrolls to the appropriate section based on mode (photo vs. select)

### Manual Availability System

#### Check Manual Endpoint
New API endpoint to check if a manual exists:
```
GET /api/check-manual/{manufacturer}/{model}
```

Response:
```json
{
  "has_manual": true,
  "device_name": "Dräger Atlan A350"
}
```

#### Notification Display
Compact notifications in the chat section:
- **📚 Green:** "Official manual available — Halo will search the documentation for answers."
- **🌐 Amber:** "No manual found — Halo will search the internet. Please verify critical info."

### Web Search Fallback

When no manual is available, Halo:
1. Searches the internet using ChatGPT
2. Clearly labels responses as "Internet Source"
3. Recommends users verify critical information

### Chat Header Improvements

```
┌──────────────────────────────────────────────────────────────┐
│  🖼️   Ask Halo                          [✏️ Edit] [🗑️ Clear]│
│ (72px) Dräger Atlan A350                                     │
├──────────────────────────────────────────────────────────────┤
│  📚 Official manual available — Halo will search the docs... │
├──────────────────────────────────────────────────────────────┤
│  ...chat messages...                                         │
├──────────────────────────────────────────────────────────────┤
│  ⭕ [Ask Halo anything about this device...        ] [Ask]   │
└──────────────────────────────────────────────────────────────┘
```

Features:
- Device icon (72px) on left of title
- Current device name displayed in subtitle
- "Edit" button to change device selection
- "Clear" button to reset chat history
- Pulsating SVG next to input box

---

## Future Enhancements

- [ ] Environment variable for API key
- [ ] Multiple documents per device model
- [ ] Database logging (Firebase)
- [ ] Image-aware RAG (OCR on manual diagrams)
- [ ] CDN for PDF storage
- [ ] Mobile-responsive design improvements
- [ ] Voice input for questions
- [ ] Export chat history

---

*Last updated: December 2025*

