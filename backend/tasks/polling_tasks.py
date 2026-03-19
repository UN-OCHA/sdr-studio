from sqlmodel import Session, select
from datetime import datetime, timezone, timedelta
import feedparser
import time
from database import engine
from models import Source, Article
from tasks.article_tasks import import_articles_logic
from tasks.discovery_tasks import discover_from_source

def poll_sources_task():
    """Periodically check all active sources for new articles, respecting their polling intervals."""
    with Session(engine) as session:
        # Get all active sources
        sources = session.exec(select(Source).where(Source.active == True)).all()
        
        if not sources:
            return

        now = datetime.now(timezone.utc)
        
        for source in sources:
            try:
                # Check if it's time to poll this source
                should_poll = False
                if source.last_polled is None:
                    should_poll = True
                else:
                    # Convert last_polled to UTC if it's not (though it should be)
                    lp = source.last_polled
                    if lp.tzinfo is None:
                        lp = lp.replace(tzinfo=timezone.utc)
                    
                    elapsed = now - lp
                    if elapsed >= timedelta(minutes=source.polling_interval or 15):
                        should_poll = True
                
                if not should_poll:
                    continue

                print(f"Polling source: {source.name} (Type: {source.type}, Interval: {source.polling_interval}m)")
                
                if source.type == "rss":
                    feed = feedparser.parse(source.url)
                    new_urls = []
                    
                    for entry in feed.entries:
                        url = entry.link
                        # Basic check if article already exists in this project
                        existing = session.exec(
                            select(Article).where(Article.project_id == source.project_id).where(Article.url == url)
                        ).first()
                        
                        if not existing:
                            new_urls.append(url)
                    
                    if new_urls:
                        print(f"    Found {len(new_urls)} new articles in {source.name}")
                        import_articles_logic(source.project_id, new_urls, source.org_id, session, None)
                
                elif source.type in ["exa", "brave"]:
                    # Discovery tasks handle their own article import logic
                    discover_from_source(source.id)
                
                # Update last_polled
                source.last_polled = datetime.now(timezone.utc)
                session.add(source)
                session.commit()
                
            except Exception as e:
                print(f"Error polling source {source.name}: {e}")

def poller_loop():
    # Wait a bit for server to start
    time.sleep(10)
    print("Starting background poller loop (1m precision)...")
    while True:
        try:
            poll_sources_task()
        except Exception as e:
            print(f"Poller loop error: {e}")
        # Run check every minute to pick up sources as they become due
        time.sleep(60)
