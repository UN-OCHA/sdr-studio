from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session, select, func, or_, desc, asc, delete
from database import get_session
from auth import get_current_org_id
from models import (
    Project, Article, ArticleRead, ArticleUpdate, ArticleImport, DiscoveryRequest,
    ArticleReadWithAnnotations, ArticleListResponse, Annotation, AnnotationUpdate
)
from tasks.article_tasks import import_articles_logic, process_article_task
from tasks.discovery_tasks import run_one_off_discovery

router = APIRouter(tags=["articles"])

@router.get("/api/projects/{project_id}/articles", response_model=ArticleListResponse)
def list_articles(
    project_id: UUID, 
    search: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    org_id: str = Depends(get_current_org_id),
    session: Session = Depends(get_session)
):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
        
    query = select(Article).where(Article.project_id == project_id)
    
    if search:
        query = query.where(or_(
            Article.title.ilike(f"%{search}%"),
            Article.url.ilike(f"%{search}%")
        ))
    
    if status and status != "all":
        query = query.where(Article.status == status)
    
    total_query = select(func.count(Article.id)).where(Article.project_id == project_id)
    if search:
        total_query = total_query.where(or_(
            Article.title.ilike(f"%{search}%"),
            Article.url.ilike(f"%{search}%")
        ))
    if status and status != "all":
        total_query = total_query.where(Article.status == status)
    
    total = session.exec(total_query).one()
    
    sort_col = getattr(Article, sort_by, Article.created_at)
    if sort_order == "desc":
        query = query.order_by(desc(sort_col))
    else:
        query = query.order_by(asc(sort_col))
    
    query = query.offset(skip).limit(limit)
    
    articles = session.exec(query).all()
    for article in articles:
        _ = article.annotations
    return {"articles": articles, "total": total}

@router.post("/api/projects/{project_id}/articles/bulk-delete")
def bulk_delete_articles(project_id: UUID, article_ids: List[UUID], org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
        
    articles = session.exec(select(Article).where(Article.id.in_(article_ids)).where(Article.project_id == project_id)).all()
    for article in articles:
        session.delete(article)
    session.commit()
    return {"message": f"Deleted {len(articles)} articles"}

@router.post("/api/projects/{project_id}/import")
def import_articles(project_id: UUID, data: ArticleImport, background_tasks: BackgroundTasks, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    count = import_articles_logic(project_id, data.urls, org_id, session, background_tasks)
    if count is None:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    return {"message": f"Imported {count} articles and processing started"}

@router.post("/api/projects/{project_id}/discover")
def discover_articles(project_id: UUID, data: DiscoveryRequest, background_tasks: BackgroundTasks, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    # Check if project exists and user has access
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    
    # Run discovery in foreground for immediate feedback
    count = run_one_off_discovery(project_id, data.type, data.url, data.config or {}, org_id)
    return {"message": f"Discovery finished. Found {count} new articles.", "count": count}

@router.get("/api/articles/{article_id}", response_model=ArticleReadWithAnnotations)
def get_article(article_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    article = session.exec(
        select(Article).join(Project).where(Article.id == article_id).where(Project.org_id == org_id)
    ).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found or access denied")
    _ = article.annotations
    return article

@router.patch("/api/articles/{article_id}", response_model=ArticleRead)
def update_article(article_id: UUID, data: ArticleUpdate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    article = session.exec(
        select(Article).join(Project).where(Article.id == article_id).where(Project.org_id == org_id)
    ).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found or access denied")
    
    if data.title is not None:
        article.title = data.title
    if data.summary is not None:
        article.summary = data.summary
    if data.reviewed is not None:
        article.reviewed = data.reviewed
    if data.structured_data is not None:
        article.structured_data = data.structured_data
        
    session.add(article)
    session.commit()
    session.refresh(article)
    return article

@router.delete("/api/articles/{article_id}")
def delete_article(article_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    article = session.exec(
        select(Article).join(Project).where(Article.id == article_id).where(Project.org_id == org_id)
    ).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found or access denied")
    session.delete(article)
    session.commit()
    return {"message": "Article deleted"}

@router.patch("/api/articles/{article_id}/annotations")
def update_annotations(article_id: UUID, data: AnnotationUpdate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    article = session.exec(
        select(Article).join(Project).where(Article.id == article_id).where(Project.org_id == org_id)
    ).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found or access denied")
    session.exec(delete(Annotation).where(Annotation.article_id == article_id))
    for ann in data.annotations:
        new_ann = Annotation(
            article_id=article_id, 
            start=ann.start, 
            end=ann.end, 
            label=ann.label, 
            confidence=getattr(ann, 'confidence', None),
            org_id=org_id
        )
        session.add(new_ann)
    session.commit()
    return {"message": "Annotations updated"}

@router.post("/api/articles/{article_id}/process")
def process_article(article_id: UUID, background_tasks: BackgroundTasks, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    article = session.exec(
        select(Article).join(Project).where(Article.id == article_id).where(Project.org_id == org_id)
    ).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found or access denied")
    background_tasks.add_task(process_article_task, article_id)
    return {"message": "Processing started in background"}
