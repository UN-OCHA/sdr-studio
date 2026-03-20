from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_db_and_tables
from routers import auth, templates, projects, articles, sources, adapters, orgs, users
from tasks.polling_tasks import poller_loop
from threading import Thread

app = FastAPI(title="SDR Studio API")

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

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    
    # Start poller in background
    Thread(target=poller_loop, daemon=True).start()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
