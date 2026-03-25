from uuid import UUID
from typing import List, Optional
from sqlmodel import Session, select, delete
from curl_cffi import requests
from trafilatura import fetch_url, extract_metadata, extract
import bs4
import re
from database import engine
from models import Project, Article, Annotation
from utils.model_loader import get_summarizer, get_gliner, get_cleaning_model
from utils.extraction_utils import build_gliner_schema
from utils.config import DEFAULT_CONFIG

import time

def import_articles_logic(project_id: UUID, urls: List[str], org_id: str, session: Session, background_tasks = None, source_id: Optional[UUID] = None, source_type: str = "manual"):
    # Verify project belongs to org
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        return None

    imported_count = 0
    for url in urls:
        # Check if already exists in this project
        existing = session.exec(
            select(Article).where(Article.project_id == project_id).where(Article.url == url)
        ).first()
        if existing:
            continue
            
        article = Article(
            project_id=project_id, 
            url=url, 
            org_id=org_id, 
            source_id=source_id, 
            source_type=source_type,
            status="pending"
        )
        session.add(article)
        session.commit()
        session.refresh(article)
        
        imported_count += 1
        
        # We no longer start threads here; the background loop will pick them up.
    return imported_count

def reset_processing_articles():
    """On startup, reset articles stuck in 'processing' back to 'pending'."""
    with Session(engine) as session:
        stuck_articles = session.exec(select(Article).where(Article.status == "processing")).all()
        for article in stuck_articles:
            article.status = "pending"
            article.processing_step = None
            session.add(article)
        session.commit()
        if stuck_articles:
            print(f"Reset {len(stuck_articles)} stuck articles to pending.")

def process_pending_articles_loop():
    """Background loop that picks up pending articles and processes them sequentially."""
    print("Starting article processing loop...")
    while True:
        try:
            with Session(engine) as session:
                # Find the next pending article
                article = session.exec(
                    select(Article).where(Article.status == "pending").order_by(Article.created_at.asc())
                ).first()
                
                if article:
                    # We process it
                    # Note: process_article_task opens its own session, which is fine
                    process_article_task(article.id)
                else:
                    # No pending articles, sleep for a bit
                    time.sleep(5)
        except Exception as e:
            print(f"Error in processing loop: {e}")
            time.sleep(10)

def _download_and_clean(article: Article, config: dict):
    downloaded = requests.get(article.url, timeout=60, impersonate="chrome", allow_redirects=True)
    downloaded.raise_for_status()
        
    metadata = extract_metadata(downloaded.content)
    contents = extract(downloaded.content)
    
    if not contents:
        # Fallback to basic soup extraction if trafilatura fails
        soup = bs4.BeautifulSoup(downloaded, "lxml")
        for element in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
            element.decompose()
        main_content = soup.find('article') or soup.find('main') or soup.find(id=re.compile(r'content|article|body', re.I))
        target = main_content if main_content else soup
        clean_text = target.get_text(separator="\n", strip=True)
        if not article.title and soup.title:
            article.title = soup.title.string
    else:
        article.title = metadata.title
        clean_text = contents
    
    # Base text extraction normalization
    clean_text = clean_text.replace('\xa0', ' ') # Remove non-breaking spaces
    clean_text = re.sub(r'[ \t]+', ' ', clean_text) # Normalize horizontal whitespace

    if article.title and len(article.title) > 10:
        title_norm = re.sub(r'\W+', '', article.title.lower())
        lines = clean_text.split('\n')
        for i, line in enumerate(lines[:15]): # Check top of document
            line_norm = re.sub(r'\W+', '', line.lower())
            if title_norm[:30] in line_norm:
                clean_text = "\n".join(lines[i+1:]).strip()
                break
    
    # --- Content Cleaning (Slop Patterns) ---
    slop_patterns = [
        r"(?i)^read more:.*",
        r"(?i)^related (articles|stories):.*",
        r"(?i)follow us on (twitter|facebook|instagram|linkedin).*",
        r"(?i)image copyright.*",
        r"(?i)reporting by .*?; editing by .*",
        r"\[\d+\]", # Remove citation markers like [1]
        r"^Advertisement$",
        r"^Story continues below advertisement$",
    ]
    for pattern in slop_patterns:
        clean_text = re.sub(pattern, "", clean_text, flags=re.MULTILINE)
    
    # --- Local Model Start Detection (Secondary Check) ---
    cleaning_cfg = config.get("cleaning", {})
    if cleaning_cfg.get("use_local_model", False):
        tokenizer, model = get_cleaning_model()
        context = clean_text[:1500]
        prompt = f"Identify the exact first sentence of the story: {context}"
        
        inputs = tokenizer(prompt, return_tensors="pt", max_length=512, truncation=True)
        outputs = model.generate(inputs["input_ids"], max_length=100)
        first_sentence = tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
        
        if len(first_sentence) > 15:
            idx = clean_text.find(first_sentence[:40])
            if 0 < idx < 1000: # Only trim if we found it near the current top
                clean_text = clean_text[idx:].strip()

    # Final whitespace cleanup
    clean_text = re.sub(r'\n{3,}', '\n\n', clean_text).strip()
    article.content = clean_text
    return clean_text

def _generate_summary(article: Article, clean_text: str, config: dict):
    summary_model_id = config.get("summary_model_id", "sshleifer/distilbart-cnn-12-6")
    tokenizer, model = get_summarizer(summary_model_id)
    input_text = clean_text[:3000]
    if len(input_text) > 100:
        inputs = tokenizer(input_text, return_tensors="pt", max_length=1024, truncation=True)
        summary_ids = model.generate(inputs["input_ids"], max_length=150, min_length=40, length_penalty=2.0, num_beams=4, early_stopping=True)
        article.summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
    else:
        article.summary = clean_text

def _run_extraction_and_geocode(article: Article, session: Session, clean_text: str, config: dict):
    model_id = config.get("model_id", "fastino/gliner2-base-v1")
    adapter_path = config.get("active_adapter_path")
    threshold = config.get("threshold", 0.3)
    
    extractor = get_gliner(model_id, adapter_path)
    schema = build_gliner_schema(extractor, config)
    results = extractor.extract(clean_text, schema, threshold=threshold, include_spans=True, include_confidence=True)

    session.exec(delete(Annotation).where(Annotation.article_id == article.id))

    entity_groups = results.get("entities", {})
    for label, items in entity_groups.items():
        for ent in items:
            ann = Annotation(
                article_id=article.id,
                start=ent["start"],
                end=ent["end"],
                label=label,
                confidence=ent.get("confidence"),
                org_id=article.org_id
            )
            session.add(ann)
    article.structured_data = {k: v for k, v in results.items() if k != "entities"}

    # --- Geocoding Step ---
    from utils.geo_utils import geocode_locations
    
    location_label = None
    if 'entities' in config and isinstance(config['entities'], dict):
        for label, entity_def in config['entities'].items():
            if isinstance(entity_def, dict) and entity_def.get('is_location', False):
                location_label = label
                break
    
    # Fallback for common location labels if not explicitly marked
    if not location_label:
        common_location_labels = ["Location", "LOC", "GPE", "Place"]
        for label in entity_groups.keys():
            if any(c.lower() == label.lower() for c in common_location_labels):
                location_label = label
                break
    
    if location_label and location_label in entity_groups:
        location_names = [ent['text'] for ent in entity_groups[location_label] if 'text' in ent]
        if location_names:
            geocoded_results = geocode_locations(location_names)
            article.locations = geocoded_results
    
    # --- Date Parsing Step ---
    date_label = None
    if 'entities' in config and isinstance(config['entities'], dict):
        for label, entity_def in config['entities'].items():
            if isinstance(entity_def, dict) and entity_def.get('is_date', False):
                date_label = label
                break
    
    if not date_label:
        common_date_labels = ["Date", "Time", "DateTime", "Temporal"]
        for label in entity_groups.keys():
            if any(c.lower() == label.lower() for c in common_date_labels):
                date_label = label
                break
    
    if date_label and date_label in entity_groups:
        date_texts = [ent['text'] for ent in entity_groups[date_label] if 'text' in ent]
        if date_texts:
            import dateparser
            parsed_date = dateparser.parse(date_texts[0], settings={'PREFER_DATES_FROM': 'past'})
            if parsed_date:
                article.event_date = parsed_date

from utils.model_loader import get_summarizer, get_gliner, get_cleaning_model, get_translation_model
from langdetect import detect, DetectorFactory
DetectorFactory.seed = 0 # Ensure deterministic detection

def _translate_content(article: Article, raw_text: str, config: dict):
    # Detect language first
    try:
        lang = detect(raw_text)
        if lang == 'en':
            print(f"Article {article.id} is already in English ({lang}), skipping translation.")
            return raw_text
    except Exception as e:
        print(f"Language detection failed: {e}")
        # Default to translate if we can't tell

    trans_cfg = config.get("translation", {})
    model_id = trans_cfg.get("model_id", "google-t5/t5-small")
    tokenizer, model = get_translation_model(model_id)
    
    # Simple chunking for T5 as it has a max length
    # We'll take the first ~3000 chars of readability-extracted content for now
    content_to_translate = raw_text[:3000]
    
    # T5 prompt for translation
    prompt = f"translate to English: {content_to_translate}"
    
    inputs = tokenizer(prompt, return_tensors="pt", max_length=1024, truncation=True)
    outputs = model.generate(inputs["input_ids"], max_length=1024)
    translated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
    
    # IMPORTANT: Update article.content so extraction offsets match what is shown in UI
    article.content = translated_text
    
    return translated_text

def process_article_task(article_id: UUID):
    with Session(engine) as session:
        article = session.get(Article, article_id)
        if not article: return
        project = session.get(Project, article.project_id)
        if not project: return
        
        config = project.extraction_config or DEFAULT_CONFIG
        
        # Define steps based on configuration
        steps = ["Downloading source..."]
        if config.get("translation", {}).get("enabled", False):
            steps.append("Translating to English...")
        
        steps.append("Generating summary...")
        steps.append("Running GLiNER2 extraction & enrichment...")
        
        article.status = "processing"
        article.processing_steps = steps
        article.processing_step = steps[0]
        article.reviewed = False # Reset reviewed status on reprocess
        session.add(article)
        session.commit()
        
        try:
            # 1. Download & Clean
            clean_text = _download_and_clean(article, config)
            
            # 2. Translation (Optional)
            if config.get("translation", {}).get("enabled", False):
                article.processing_step = "Translating to English..."
                session.add(article)
                session.commit()
                clean_text = _translate_content(article, clean_text, config)

            # 3. Summary
            article.processing_step = "Generating summary..."
            session.add(article)
            session.commit()
            _generate_summary(article, clean_text, config)
            
            # 4. Extraction, Geocode, Date Parsing
            article.processing_step = "Running GLiNER2 extraction & enrichment..."
            session.add(article)
            session.commit()
            _run_extraction_and_geocode(article, session, clean_text, config)

            article.status = "completed"
            article.processing_step = None
        except Exception as e:
            article.status = "error"
            article.error_message = f"{type(e).__name__}: {str(e)}"
            import traceback
            traceback.print_exc()
        
        session.add(article)
        session.commit()
