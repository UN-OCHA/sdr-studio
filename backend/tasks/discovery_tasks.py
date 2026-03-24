import os
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID
from sqlmodel import Session, select, desc
from curl_cffi import requests
import feedparser
from datetime import datetime, timezone
from database import engine
from models import Source, Article, Project, DiscoveryLog
from tasks.article_tasks import import_articles_logic
from dotenv import load_dotenv

load_dotenv()

EXA_API_KEY = os.getenv("EXA_API_KEY")
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY")

def discover_exa(query: str, config: Dict[str, Any], limit: int = 10) -> Tuple[List[Dict[str, Any]], float]:
    """Search for links using Exa (Metaphor) API."""
    if not EXA_API_KEY:
        print("EXA_API_KEY not found in environment")
        return [], 0.0
    
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
        data = response.json()
        results = data.get("results", [])
        
        # Exa API can return cost as a float or a dictionary with a 'total' key
        raw_cost = data.get("costDollars", data.get("cost", 0.0))
        if isinstance(raw_cost, dict):
            cost = raw_cost.get("total", 0.0)
        else:
            cost = raw_cost
            
        articles = [
            {
                "url": r["url"],
                "title": r.get("title", ""),
                "description": r.get("text", "")[:200] + "..." if r.get("text") else "",
                "published_date": r.get("publishedDate"),
                "source": "Exa"
            }
            for r in results
        ]
        return articles, float(cost)
    except Exception as e:
        print(f"Exa search error: {e}")
        return [], 0.0

def discover_brave(query: str, config: Dict[str, Any], limit: int = 10) -> List[Dict[str, Any]]:
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
        return [
            {
                "url": r["url"],
                "title": r.get("title", ""),
                "description": r.get("description", ""),
                "published_date": r.get("page_age"),
                "source": "Brave"
            }
            for r in results
        ]
    except Exception as e:
        print(f"Brave search error: {e}")
        return []

def discover_rss(url: str) -> List[Dict[str, Any]]:
    """Search for links using RSS feed."""
    try:
        feed = feedparser.parse(url)
        return [
            {
                "url": entry.link,
                "title": entry.get("title", ""),
                "description": entry.get("summary", "")[:200] + "..." if entry.get("summary") else "",
                "published_date": entry.get("published"),
                "source": feed.get("feed", {}).get("title", "RSS Feed")
            }
            for entry in feed.entries
        ]
    except Exception as e:
        print(f"RSS fetch error: {e}")
        return []

def run_one_off_discovery(project_id: UUID, type: str, query_or_url: str, config: Dict[str, Any], org_id: str):
    """Run discovery manually (one-off) and return articles for preview."""
    print(f"Manual discovery: {query_or_url} ({type})")
    
    limit = config.get("limit", 10)
    articles = []
    cost = 0.0
    
    if type == "exa":
        articles, cost = discover_exa(query_or_url, config, limit)
    elif type == "brave":
        articles = discover_brave(query_or_url, config, limit)
    elif type == "rss":
        articles = discover_rss(query_or_url)
        
    # Log the discovery
    if articles or cost > 0:
        with Session(engine) as session:
            log = DiscoveryLog(
                project_id=project_id,
                type=type,
                query=query_or_url,
                cost=cost,
                article_count=len(articles),
                org_id=org_id
            )
            session.add(log)
            
            # Update project total cost
            project = session.get(Project, project_id)
            if project:
                if not project.total_cost: project.total_cost = 0.0
                project.total_cost += cost
                session.add(project)
                
            session.commit()
        
    return articles

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
        cost = 0.0
        articles_data = []

        if source.type == "exa":
            articles_data, cost = discover_exa(source.url, config, limit)
            urls = [a["url"] for a in articles_data]
        elif source.type == "brave":
            articles_data = discover_brave(source.url, config, limit)
            urls = [a["url"] for a in articles_data]
        elif source.type == "rss":
            articles_data = discover_rss(source.url)
            urls = [a["url"] for a in articles_data]
            
        # Log the discovery
        log = DiscoveryLog(
            project_id=source.project_id,
            source_id=source.id,
            type=source.type,
            query=source.url,
            cost=cost,
            article_count=len(articles_data),
            org_id=source.org_id
        )
        session.add(log)

        # Update source and project totals
        source.last_polled = datetime.now(timezone.utc)
        source.last_polled_cost = cost
        if not source.total_cost: source.total_cost = 0.0
        source.total_cost += cost
        session.add(source)

        project = session.get(Project, source.project_id)
        if project:
            if not project.total_cost: project.total_cost = 0.0
            project.total_cost += cost
            session.add(project)

        session.commit()

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
            import_articles_logic(
                source.project_id, 
                new_urls, 
                source.org_id, 
                session, 
                None,
                source_id=source.id,
                source_type=source.type
            )
        else:
            print(f"No new articles found via {source.type} discovery")
