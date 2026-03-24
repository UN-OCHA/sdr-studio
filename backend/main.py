from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_db_and_tables
from routers import auth, templates, projects, articles, sources, adapters, orgs, users
from tasks.polling_tasks import poller_loop
from threading import Thread

from tasks.article_tasks import reset_processing_articles, process_pending_articles_loop

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    create_db_and_tables()
    
    # Recovery: reset stuck articles
    reset_processing_articles()
    
    # Start poller in background
    poller_thread = Thread(target=poller_loop, daemon=True)
    poller_thread.start()
    
    # Start article processor in background
    processor_thread = Thread(target=process_pending_articles_loop, daemon=True)
    processor_thread.start()
    
    yield
    # Shutdown (if needed)

app = FastAPI(title="SDR Studio API", lifespan=lifespan)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(templates.router)
app.include_router(projects.router)
app.include_router(articles.router)
app.include_router(sources.router)
app.include_router(adapters.router)
app.include_router(orgs.router)
app.include_router(users.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
