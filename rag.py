# -*- coding: utf-8 -*-
"""
RAG (Retrieval-Augmented Generation) Module

Handles all manual-based question answering:
1. Looks up device in database
2. Downloads PDF if needed
3. Creates/loads vector index
4. Queries and returns answer
"""
import os
import sys

# Fix for Windows encoding issues - force UTF-8
if sys.platform == 'win32':
    import locale
    # Set UTF-8 as default encoding for file operations
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
from typing import Optional, List, Dict, Any
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, StorageContext, load_index_from_storage, Settings
from llama_index.llms.openai import OpenAI
from llama_index.embeddings.openai import OpenAIEmbedding

from device_database import get_model_docs
from utils.web_utils import download_pdf
from utils.pdf_images import get_images_for_pages


# Directory where vector indexes are cached
INDEX_DIR = "vector_indexes"

# LLM and embed_model are initialized lazily to avoid import-time errors
_llm = None
_embed_model = None


def _get_llm():
    """Lazily initialize and return the LLM instance."""
    global _llm, _embed_model
    
    if _llm is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "OPENAI_API_KEY environment variable is not set. "
                "Please set it before running the application."
            )
        
        _llm = OpenAI(model="gpt-4o-mini", api_key=api_key)
        _embed_model = OpenAIEmbedding(api_key=api_key)
        
        # Set global defaults
        Settings.llm = _llm
        Settings.embed_model = _embed_model
    
    return _llm


def _get_embed_model():
    """Lazily initialize and return the embedding model."""
    _get_llm()  # Ensures initialization
    return _embed_model


def _get_manual_path(manufacturer: str, model: str) -> Optional[str]:
    """
    Internal function to get the local path to a manual, downloading if necessary.
    
    Returns the local file path, or None if unavailable.
    """
    docs = get_model_docs(manufacturer, model)
    if not docs:
        return None
    
    local_path = docs.get("local")
    remote_url = docs.get("remote")
    
    if not local_path:
        return None
    
    # Use local file if it exists
    if os.path.exists(local_path):
        print(f"📁 Using local manual: {local_path}")
        return local_path
    
    # Try to download from remote
    if remote_url:
        if download_pdf(remote_url, local_path):
            return local_path
        print(f"⚠️ Could not download manual for {manufacturer} {model}")
        return None
    
    print(f"⚠️ No manual available for {manufacturer} {model}")
    return None


def _load_or_create_index(pdf_path: str) -> VectorStoreIndex:
    """
    Loads an existing vector index or creates a new one from a PDF.
    """
    manual_name = os.path.splitext(os.path.basename(pdf_path))[0]
    index_path = f"{INDEX_DIR}/{manual_name}"

    # Load existing index if available
    if os.path.exists(index_path) and os.path.exists(f"{index_path}/docstore.json"):
        print(f"📁 Loading existing vector index for {manual_name}")
        storage = StorageContext.from_defaults(persist_dir=index_path)
        return load_index_from_storage(storage)

    # Create new index
    print(f"⚠ No index found — creating new index for {manual_name}")
    os.makedirs(index_path, exist_ok=True)

    docs = SimpleDirectoryReader(input_files=[pdf_path]).load_data()
    index = VectorStoreIndex.from_documents(docs)
    index.storage_context.persist(persist_dir=index_path)

    print("✅ Index created & cached:", index_path)
    return index


def ask_question(manufacturer: str, model: str, question: str, history: Optional[List[Dict]] = None) -> Dict[str, Any]:
    """
    Main entry point for asking questions about a device.
    Supports follow-up questions via chat history.
    
    Args:
        manufacturer: Device manufacturer name
        model: Device model number
        question: User's question
        history: Optional list of previous messages [{"role": "user/assistant", "content": "..."}]
    
    Returns:
        Dict with keys:
        - answer: The generated answer (or None if error)
        - error: Error message (or None if success)
        - sources: List of source chunks used to generate the answer
        - confidence: Average similarity score of retrieved chunks
    """
    # Get the manual path (downloads if needed)
    manual_path = _get_manual_path(manufacturer, model)
    
    # Fallback: try by model alone
    if not manual_path and manufacturer:
        manual_path = _get_manual_path("", model)
    
    if not manual_path:
        return {
            "answer": None,
            "error": f"No manual found for {manufacturer} {model}. Chat is not available for this device.",
            "sources": [],
            "confidence": 0,
            "images": []
        }
    
    try:
        # Load/create index and query
        print(f"📖 Using manual: {manual_path}")
        llm = _get_llm()  # Get the lazily-initialized LLM
        index = _load_or_create_index(manual_path)
        engine = index.as_query_engine(
            llm=llm,
            similarity_top_k=3,
            response_mode="compact"
        )
        
        # IMPORTANT: Always retrieve based on current question only
        # This ensures we find relevant chunks for the NEW question,
        # not chunks related to previous conversation topics
        
        # First, retrieve relevant chunks using just the current question
        retriever = index.as_retriever(similarity_top_k=3)
        retrieved_nodes = retriever.retrieve(question)
        
        # Build the prompt for the LLM
        # Combine: retrieved context + conversation history (if any) + question
        context_str = "\n\n".join([node.node.text for node in retrieved_nodes])
        
        if history and len(history) > 0:
            # Build conversation context with smarter prompt
            history_str = "Previous conversation for reference:\n"
            for msg in history[-4:]:  # Keep last 4 messages (2 exchanges)
                role = "User" if msg["role"] == "user" else "Assistant"
                history_str += f"{role}: {msg['content']}\n"
            
            full_prompt = f"""Based on the following information from the device manual:

{context_str}

{history_str}

Current question: {question}

IMPORTANT: Answer the current question based on the manual information above.
- If this is a follow-up question (e.g., "what about...", "and how do I..."), use the conversation history for context.
- If this is a NEW TOPIC unrelated to the previous conversation, ignore the history and answer based solely on the manual.
- Provide accurate, helpful information."""
            print(f"📝 Using conversation context ({len(history)} messages)")
        else:
            full_prompt = f"""Based on the following information from the device manual:

{context_str}

Question: {question}

Please provide an accurate, helpful answer based on the manual information above."""
        
        # Generate answer using the LLM
        response_text = str(llm.complete(full_prompt))
        
        # Extract source information from retrieved nodes
        sources = []
        total_score = 0
        
        for node in retrieved_nodes:
            # Get similarity score
            score = node.score if node.score is not None else 0
            total_score += score
            
            # Get page number from metadata (if available)
            page = None
            if hasattr(node, 'node') and hasattr(node.node, 'metadata'):
                metadata = node.node.metadata
                # Try common page number keys
                page = metadata.get('page_label') or metadata.get('page') or metadata.get('page_number')
            
            # Get the text content
            text = node.node.text if hasattr(node, 'node') else str(node)
            
            # Truncate very long chunks for the response (keep first 500 chars)
            if len(text) > 500:
                text = text[:500] + "..."
            
            sources.append({
                "text": text,
                "score": round(score, 3),
                "page": page
            })
        
        # Calculate average confidence
        avg_confidence = total_score / len(retrieved_nodes) if retrieved_nodes else 0
        
        # Get images from the source pages
        page_numbers = [s["page"] for s in sources if s["page"]]
        images = []
        if page_numbers and manual_path:
            try:
                images = get_images_for_pages(manual_path, page_numbers)
                # Limit to first 5 images to avoid overwhelming the UI
                images = images[:5]
                print(f"📸 Found {len(images)} images from pages {page_numbers}")
            except Exception as e:
                print(f"⚠️ Could not extract images: {e}")
        
        return {
            "answer": response_text,
            "error": None,
            "sources": sources,
            "confidence": round(avg_confidence, 3),
            "images": images
        }
        
    except Exception as e:
        print(f"❌ RAG error: {e}")
        return {
            "answer": None,
            "error": f"Error processing question: {str(e)}",
            "sources": [],
            "confidence": 0,
            "images": []
        }
