from sqlmodel import Session, select
from datetime import datetime, timezone
import feedparser
import time
from database import engine
from models import Source, Article
from tasks.article_tasks import import_articles_logic

def poll_sources_task():
    """Periodically check all active sources for new articles."""
    with Session(engine) as session:
        sources = session.exec(select(Source).where(Source.active == True)).all()
        
        if not sources:
            print("No active monitoring sources found.")
            return

        print(f"Polling {len(sources)} active sources...")
        for source in sources:
            try:
                print(f"  > Polling: {source.name} ({source.url})")
                
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
                    else:
                        print(f"    No new articles found in {source.name}")
                
                # Update last_polled
                source.last_polled = datetime.now(timezone.utc)
                session.add(source)
                session.commit()
                
            except Exception as e:
                print(f"Error polling source {source.name}: {e}")

def poller_loop():
    # Wait a bit for server to start
    time.sleep(10)
    while True:
        try:
            poll_sources_task()
        except Exception as e:
            print(f"Poller loop error: {e}")
        # Poll every 15 minutes
        time.sleep(900)
