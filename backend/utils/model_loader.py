from typing import Optional, Dict, Tuple
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from gliner2 import GLiNER2
import os

# Global models cache to avoid reloading on every task
summarizer_cache: Dict[str, Tuple[AutoTokenizer, AutoModelForSeq2SeqLM]] = {}
gliner_cache: Dict[str, GLiNER2] = {}
cleaning_cache: Dict[str, Tuple[AutoTokenizer, AutoModelForSeq2SeqLM]] = {}

def get_summarizer(model_name: str = "sshleifer/distilbart-cnn-12-6"):
    if model_name not in summarizer_cache:
        print(f"Loading summarization model ({model_name})...")
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        summarizer_cache[model_name] = (tokenizer, model)
    return summarizer_cache[model_name]

def get_gliner(model_id: str, adapter_path: Optional[str] = None):
    # Use a combined key for cache to distinguish between base model and adapters
    cache_key = f"{model_id}::{adapter_path}" if adapter_path else model_id
    
    if cache_key not in gliner_cache:
        print(f"Loading GLiNER2 model ({model_id}) with adapter ({adapter_path})...")
        model = GLiNER2.from_pretrained(model_id)
        if adapter_path and os.path.exists(adapter_path):
            model.load_adapter(adapter_path)
        gliner_cache[cache_key] = model
    return gliner_cache[cache_key]

def get_cleaning_model(model_id: str = "google/flan-t5-small"):
    if model_id not in cleaning_cache:
        print(f"Loading cleaning model ({model_id})...")
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_id)
        cleaning_cache[model_id] = (tokenizer, model)
    return cleaning_cache[model_id]
