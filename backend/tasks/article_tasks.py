from uuid import UUID
from typing import List, Optional
from sqlmodel import Session, select, delete
from curl_cffi import requests
from readability import Document
import bs4
import re
from database import engine
from models import Project, Article, Annotation
from utils.model_loader import get_summarizer, get_gliner, get_cleaning_model
from utils.extraction_utils import build_gliner_schema
from utils.config import DEFAULT_CONFIG

def import_articles_logic(project_id: UUID, urls: List[str], org_id: str, session: Session, background_tasks = None):
    # Verify project belongs to org
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        return None

    for url in urls:
        article = Article(project_id=project_id, url=url, org_id=org_id)
        session.add(article)
        session.commit()
        session.refresh(article)
        
        if background_tasks:
            background_tasks.add_task(process_article_task, article.id)
        else:
            from threading import Thread
            Thread(target=process_article_task, args=(article.id,)).start()
    return len(urls)

def process_article_task(article_id: UUID):
    with Session(engine) as session:
        article = session.get(Article, article_id)
        if not article: return
        project = session.get(Project, article.project_id)
        if not project: return
        
        config = project.extraction_config or DEFAULT_CONFIG
        model_id = config.get("model_id", "fastino/gliner2-base-v1")
        adapter_path = config.get("active_adapter_path")
        summary_model_id = config.get("summary_model_id", "sshleifer/distilbart-cnn-12-6")
        threshold = config.get("threshold", 0.3)
        
        article.status = "processing"
        article.processing_step = "Downloading source..."
        article.reviewed = False # Reset reviewed status on reprocess
        session.add(article)
        session.commit()
        
        try:
            response = requests.get(article.url, timeout=60, impersonate="chrome", allow_redirects=True)
            response.raise_for_status()
            doc = Document(response.text)
            article.title = doc.title()
            soup = bs4.BeautifulSoup(doc.summary(), "lxml")
            
            # Base text extraction
            clean_text = re.sub(r'\n{2,}', '\n\n', soup.get_text(separator="\n").strip())
            
            # --- Content Cleaning (Internal Slop Removal) ---
            slop_patterns = [
                r"^list of \d+ items$",
                r"^end of list$",
                r"^Advertisement$",
                r"^Story continues below advertisement$",
            ]
            for pattern in slop_patterns:
                clean_text = re.sub(pattern, "", clean_text, flags=re.IGNORECASE | re.MULTILINE)
            
            # --- Content Cleaning (Start Detection) ---
            cleaning_cfg = config.get("cleaning", {})
            if cleaning_cfg.get("use_local_model", False):
                article.processing_step = "Identifying article start point..."
                session.add(article)
                session.commit()
                tokenizer, model = get_cleaning_model()
                
                context = clean_text[:2000]
                prompt = f"Identify the exact first sentence of the news story, ignoring all headers and navigation: {context}"
                
                inputs = tokenizer(prompt, return_tensors="pt", max_length=1024, truncation=True)
                outputs = model.generate(inputs["input_ids"], max_length=120)
                first_sentence = tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
                
                if first_sentence and len(first_sentence) > 10:
                    marker = first_sentence[:40]
                    idx = clean_text.find(marker)
                    
                    if idx != -1 and idx < 1500:
                        line_start = clean_text.rfind("\n", 0, idx)
                        if line_start != -1:
                            clean_text = clean_text[line_start:].strip()
                        else:
                            clean_text = clean_text[idx:].strip()
                    else:
                        lines = clean_text.split("\n")
                        for i, line in enumerate(lines[:20]):
                            if marker[:20] in line:
                                clean_text = "\n".join(lines[i:]).strip()
                                break

            clean_text = re.sub(r'\n{3,}', '\n\n', clean_text).strip()
            article.content = clean_text
            
            article.processing_step = "Generating summary..."
            session.add(article)
            session.commit()
            tokenizer, model = get_summarizer(summary_model_id)
            input_text = clean_text[:3000]
            if len(input_text) > 100:
                inputs = tokenizer(input_text, return_tensors="pt", max_length=1024, truncation=True)
                summary_ids = model.generate(inputs["input_ids"], max_length=150, min_length=40, length_penalty=2.0, num_beams=4, early_stopping=True)
                article.summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
            else:
                article.summary = clean_text
            
            article.processing_step = f"Running GLiNER2 extraction (Adapter: {'Yes' if adapter_path else 'No'})..."
            session.add(article)
            session.commit()
            extractor = get_gliner(model_id, adapter_path)
            schema = build_gliner_schema(extractor, config)
            results = extractor.extract(clean_text, schema, threshold=threshold, include_spans=True, include_confidence=True)

            session.exec(delete(Annotation).where(Annotation.article_id == article_id))

            entity_groups = results.get("entities", {})
            count = 0
            for label, items in entity_groups.items():
                for ent in items:
                    ann = Annotation(
                        article_id=article_id,
                        start=ent["start"],
                        end=ent["end"],
                        label=label,
                        confidence=ent.get("confidence"),
                        org_id=article.org_id
                    )
                    session.add(ann)
                    count += 1
            article.structured_data = {k: v for k, v in results.items() if k != "entities"}

            # --- Geocoding Step ---
            article.processing_step = "Geocoding locations..."
            session.add(article)
            session.commit()
            
            from utils.geo_utils import geocode_locations
            
            # --- Geocoding Step ---
            article.processing_step = "Geocoding locations..."
            session.add(article)
            session.commit()
            
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
                # In GLiNER2 result, ent has 'text'
                location_names = [ent['text'] for ent in entity_groups[location_label] if 'text' in ent]
                if location_names:
                    print(f"Found {len(location_names)} locations to geocode for article {article_id}")
                    geocoded_results = geocode_locations(location_names)
                    article.locations = geocoded_results
                else:
                    print(f"No text found in entities for label {location_label} for article {article_id}")
            else:
                print(f"No location label found or no entities for article {article_id}. Label: {location_label}")
            
            # --- Date Parsing Step ---
            date_label = None
            if 'entities' in config and isinstance(config['entities'], dict):
                for label, entity_def in config['entities'].items():
                    if isinstance(entity_def, dict) and entity_def.get('is_date', False):
                        date_label = label
                        break
            
            # Fallback for common date labels if not explicitly marked
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
                    # Try to parse the first date found
                    parsed_date = dateparser.parse(date_texts[0], settings={'PREFER_DATES_FROM': 'past'})
                    if parsed_date:
                        article.event_date = parsed_date
                        print(f"Parsed event date for article {article_id}: {parsed_date}")

            article.status = "completed"
            article.processing_step = None
        except Exception as e:
            article.status = "error"
            article.error_message = f"{type(e).__name__}: {str(e)}"
            import traceback
            traceback.print_exc()
        
        session.add(article)
        session.commit()
