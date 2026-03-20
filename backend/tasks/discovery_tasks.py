import os
from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlmodel import Session, select
from curl_cffi import requests
import feedparser
from database import engine
from models import Source, Article, Project
from tasks.article_tasks import import_articles_logic
from dotenv import load_dotenv

load_dotenv()

EXA_API_KEY = os.getenv("EXA_API_KEY")
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY")

def discover_exa(query: str, config: Dict[str, Any], limit: int = 10) -> List[str]:
    """Search for links using Exa (Metaphor) API."""
    if not EXA_API_KEY:
        print("EXA_API_KEY not found in environment")
        return []
    
    url = "https://api.exa.ai/search"
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "x-api-key": EXA_API_KEY
    }
    
    payload = {
        "query": query,
        "useAutoprompt": config.get("use_autoprompt", True),
        "numResults": limit,
        "type": config.get("search_type", "neural")
    }
    
    # Optional filters
    if config.get("include_domains"):
        payload["includeDomains"] = config["include_domains"]
    if config.get("exclude_domains"):
        payload["excludeDomains"] = config["exclude_domains"]
    if config.get("category"):
        payload["category"] = config["category"]
    if config.get("published_after"):
        payload["startPublishedDate"] = config["published_after"]
    if config.get("published_before"):
        payload["endPublishedDate"] = config["published_before"]
        
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        results = response.json().get("results", [])
        return [r["url"] for r in results]
    except Exception as e:
        print(f"Exa search error: {e}")
        return []

def discover_brave(query: str, config: Dict[str, Any], limit: int = 10) -> List[str]:
    """Search for links using Brave Search API."""
    if not BRAVE_API_KEY:
        print("BRAVE_API_KEY not found in environment")
        return []
    
    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {
        "Accept": "application/json",
        "X-Subscription-Token": BRAVE_API_KEY
    }
    params = {
        "q": query,
        "count": limit
    }
    
    # Optional filters
    if config.get("freshness"):
        params["freshness"] = config["freshness"]
    if config.get("country"):
        params["country"] = config["country"]
    if config.get("search_lang"):
        params["search_lang"] = config["search_lang"]
    if config.get("ui_lang"):
        params["ui_lang"] = config["ui_lang"]
        
    try:
        response = requests.get(url, params=params, headers=headers, timeout=30)
        response.raise_for_status()
        results = response.json().get("web", {}).get("results", [])
        return [r["url"] for r in results]
    except Exception as e:
        print(f"Brave search error: {e}")
        return []

def discover_rss(url: str) -> List[str]:
    """Search for links using RSS feed."""
    try:
        feed = feedparser.parse(url)
        return [entry.link for entry in feed.entries]
    except Exception as e:
        print(f"RSS fetch error: {e}")
        return []

def run_one_off_discovery(project_id: UUID, type: str, query_or_url: str, config: Dict[str, Any], org_id: str):
    """Run discovery manually (one-off) and import articles."""
    with Session(engine) as session:
        print(f"Manual discovery: {query_or_url} ({type})")
        
        limit = config.get("limit", 10)
        urls = []
        if type == "exa":
            urls = discover_exa(query_or_url, config, limit)
        elif type == "brave":
            urls = discover_brave(query_or_url, config, limit)
        elif type == "rss":
            urls = discover_rss(query_or_url)
            
        if not urls:
            return 0
            
        new_urls = []
        for url in urls:
            existing = session.exec(
                select(Article).where(Article.project_id == project_id).where(Article.url == url)
            ).first()
            if not existing:
                new_urls.append(url)
                
        if new_urls:
            print(f"Manual discovery found {len(new_urls)} new articles")
            import_articles_logic(project_id, new_urls, org_id, session, None)
        return len(new_urls)

def discover_from_source(source_id: UUID):
    """Run discovery for a specific source and import new articles."""
    with Session(engine) as session:
        source = session.get(Source, source_id)
        if not source or not source.active:
            return
        
        print(f"Running discovery for source: {source.name} ({source.type})")
        
        config = source.config or {}
        limit = config.get("limit", 10)
        
        urls = []
        if source.type == "exa":
            urls = discover_exa(source.url, config, limit)
        elif source.type == "brave":
            urls = discover_brave(source.url, config, limit)
            
        if not urls:
            return
            
        new_urls = []
        for url in urls:
            existing = session.exec(
                select(Article).where(Article.project_id == source.project_id).where(Article.url == url)
            ).first()
            if not existing:
                new_urls.append(url)
                
        if new_urls:
            print(f"Found {len(new_urls)} new articles via {source.type} discovery")
            import_articles_logic(source.project_id, new_urls, source.org_id, session, None)
        else:
            print(f"No new articles found via {source.type} discovery")
