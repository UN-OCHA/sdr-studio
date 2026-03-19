import csv
import io
import secrets
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import (APIRouter, BackgroundTasks, Depends, HTTPException,
                     Query)
from fastapi.responses import StreamingResponse
from sqlmodel import Session, desc, func, select

from auth import get_current_org_id, get_org_id_from_api_key
from database import get_session
from models import (Annotation, ApiKey, ApiKeyCreate, ApiKeyRead, Article,
                    Project, ProjectCreate, ProjectRead, ProjectUpdate)
from tasks.article_tasks import process_article_task
from utils.config import DEFAULT_CONFIG
from utils.pdf_utils import markdown_to_pdf_typst

router = APIRouter(prefix="/api/projects", tags=["projects"])

def generate_report_markdown(project: Project, articles: List[Article], session: Session, report_config: dict) -> str:
    md = []
    
    header_text = report_config.get("header_text")
    if header_text:
        md.append(f"{header_text}\n")
        
    md.append(f"# Media Sweep Report: {project.name}")
    md.append(f"**Generated on:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    md.append("\n---\n")
    
    include_description = report_config.get("include_description", True)
    if include_description and project.description:
        md.append(f"{project.description}\n")
        
    include_toc = report_config.get("include_toc", True)
    grouping = report_config.get("grouping")
    sections = report_config.get("sections")

    grouped_articles = {"Default": articles}
    if grouping and grouping.get("enabled"):
        field_path = grouping.get("field", "")
        if field_path.startswith("classification."):
            class_name = field_path.replace("classification.", "")
            grouped_articles = {}
            for article in articles:
                val = (article.structured_data or {}).get(class_name, "Uncategorized")
                if isinstance(val, list): val = val[0] if val else "Uncategorized"
                
                if val not in grouped_articles: grouped_articles[val] = []
                grouped_articles[val].append(article)
    
    if include_toc:
        md.append("## Table of Contents")
        for group_name, group_list in grouped_articles.items():
            if len(grouped_articles) > 1:
                md.append(f"\n### {group_name}")
            for i, article in enumerate(group_list):
                title = article.title or article.url
                anchor = f"article-{group_name.lower().replace(' ', '-')}-{i}"
                md.append(f"{i+1}. [{title}](#{anchor})")
        md.append("\n---\n")
    
    for group_name, group_list in grouped_articles.items():
        if len(grouped_articles) > 1:
            md.append(f"## {group_name}")
            
        for i, article in enumerate(group_list):
            anchor = f"article-{group_name.lower().replace(' ', '-')}-{i}"
            md.append(f"### <a name='{anchor}'></a> {article.title or article.url}")
            
            if not sections:
                md.append(f"**URL:** {article.url}")
                md.append(f"**Date Found:** {article.created_at.strftime('%Y-%m-%d')}")
                if article.summary:
                    md.append("\n#### Summary")
                    md.append(article.summary)
            else:
                for section in sections:
                    if not section.get("enabled", True): continue
                    
                    type = section.get("type")
                    title = section.get("title")
                    config = section.get("config", {})
                    
                    if type == "metadata":
                        if not config.get("compact"):
                            if title: md.append(f"\n#### {title}")
                            md.append(f"**URL:** {article.url}")
                            md.append(f"**Date Found:** {article.created_at.strftime('%Y-%m-%d')}")
                        else:
                            md.append(f"[Source URL]({article.url}) • {article.created_at.strftime('%Y-%m-%d')}")
                            
                    elif type == "summary" and article.summary:
                        if title: md.append(f"\n#### {title}")
                        md.append(article.summary)
                        
                    elif type == "entities":
                        annotations = session.exec(select(Annotation).where(Annotation.article_id == article.id)).all()
                        if annotations:
                            if title: md.append(f"\n#### {title}")
                            grouped = {}
                            for ann in annotations:
                                if ann.label not in grouped: grouped[ann.label] = set()
                                grouped[ann.label].add(article.content[ann.start:ann.end])
                            
                            if config.get("compact"):
                                md.append(", ".join([f"**{l}:** {', '.join(t)}" for l, t in grouped.items()]))
                            else:
                                for label, texts in grouped.items():
                                    md.append(f"- **{label}:** {', '.join(texts)}")
                                    
                    elif type == "structured_data" and article.structured_data:
                        if title: md.append(f"\n#### {title}")
                        for key, val in article.structured_data.items():
                            md.append(f"- **{key}:** {val}")
                            
                    elif type == "custom_text":
                        if title: md.append(f"\n#### {title}")
                        md.append(config.get("text", ""))

            md.append("\n---\n")

    footer_text = report_config.get("footer_text")
    if footer_text:
        md.append(f"\n{footer_text}")

    return "\n".join(md)

# Logic helpers
def export_json_logic(project: Project, articles: List[Article], session: Session):
    export_config = project.export_config or {}
    fields = export_config.get("fields", [])
    export_data = []
    for article in articles:
        annotations = session.exec(select(Annotation).where(Annotation.article_id == article.id)).all()
        if not fields:
            item = {
                "url": article.url, "title": article.title, "summary": article.summary,
                "entities": [{"label": a.label, "text": article.content[a.start:a.end]} for a in annotations],
                "structured_data": article.structured_data, "created_at": article.created_at.isoformat()
            }
        else:
            item = {}
            for field in fields:
                key, label, source = field.get("key"), field.get("label", field.get("key")), field.get("source", "article")
                if source == "article":
                    val = getattr(article, key, None)
                    if isinstance(val, datetime): val = val.isoformat()
                    item[label] = val
                elif source == "structured_data":
                    item[label] = (article.structured_data or {}).get(key)
                elif source == "annotations":
                    item[label] = [article.content[a.start:a.end] for a in annotations if a.label == key]
        export_data.append(item)
    return export_data

def export_csv_logic(project: Project, articles: List[Article], session: Session):
    output = io.StringIO()
    writer = csv.writer(output)
    export_config = project.export_config or {}
    fields = export_config.get("fields", [])
    if not fields:
        writer.writerow(["Title", "URL", "Summary", "Entities", "Structured Data"])
    else:
        writer.writerow([f.get("label", f.get("key")) for f in fields])
    for article in articles:
        annotations = session.exec(select(Annotation).where(Annotation.article_id == article.id)).all()
        if not fields:
            entities_str = "; ".join([f"{a.label}: {article.content[a.start:a.end]}" for a in annotations])
            writer.writerow([article.title, article.url, article.summary, entities_str, str(article.structured_data)])
        else:
            row = []
            for field in fields:
                key, source = field.get("key"), field.get("source", "article")
                if source == "article":
                    val = getattr(article, key, "")
                    if isinstance(val, datetime): val = val.isoformat()
                    row.append(str(val))
                elif source == "structured_data":
                    row.append(str((article.structured_data or {}).get(key, "")))
                elif source == "annotations":
                    matches = [article.content[a.start:a.end] for a in annotations if a.label == key]
                    row.append("; ".join(matches))
            writer.writerow(row)
    output.seek(0)
    return output.getvalue()

@router.get("", response_model=List[ProjectRead])
def list_projects(org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    projects = session.exec(select(Project).where(Project.org_id == org_id)).all()
    return projects

@router.post("", response_model=ProjectRead)
def create_project(project_data: ProjectCreate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    config = project_data.extraction_config if project_data.extraction_config is not None else DEFAULT_CONFIG
    project = Project(
        name=project_data.name, description=project_data.description,
        icon=project_data.icon or "briefcase", org_id=org_id, extraction_config=config
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(project_id: UUID, data: ProjectUpdate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found or access denied")
    if data.name is not None: project.name = data.name
    if data.description is not None: project.description = data.description
    if data.icon is not None: project.icon = data.icon
    if data.extraction_config is not None: project.extraction_config = data.extraction_config
    if data.onboarding_completed is not None: project.onboarding_completed = data.onboarding_completed
    if data.export_config is not None: project.export_config = data.export_config
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

@router.delete("/{project_id}")
def delete_project(project_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found or access denied")
    session.delete(project)
    session.commit()
    return {"message": "Project deleted"}

@router.post("/{project_id}/reprocess")
def reprocess_project(project_id: UUID, background_tasks: BackgroundTasks, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found or access denied")
    articles = session.exec(select(Article).where(Article.project_id == project_id)).all()
    for article in articles: background_tasks.add_task(process_article_task, article.id)
    return {"message": "Reprocessing started for all articles"}

@router.get("/{project_id}/stats")
def get_project_stats(project_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found or access denied")
    total = session.exec(select(func.count(Article.id)).where(Article.project_id == project_id)).one()
    pending = session.exec(select(func.count(Article.id)).where(Article.project_id == project_id).where(Article.status == "pending")).one()
    processing = session.exec(select(func.count(Article.id)).where(Article.project_id == project_id).where(Article.status == "processing")).one()
    completed = session.exec(select(func.count(Article.id)).where(Article.project_id == project_id).where(Article.status == "completed")).one()
    error = session.exec(select(func.count(Article.id)).where(Article.project_id == project_id).where(Article.status == "error")).one()
    
    # New stats: total annotations across all articles in project
    total_annotations = session.exec(
        select(func.count(Annotation.id))
        .join(Article)
        .where(Article.project_id == project_id)
    ).one()

    return {
        "total": total, 
        "pending": pending, 
        "processing": processing, 
        "completed": completed, 
        "error": error,
        "total_annotations": total_annotations
    }

# Exports
@router.get("/{project_id}/export/json")
def export_project_json(project_id: UUID, article_ids: Optional[str] = None, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found or access denied")
    query = select(Article).where(Article.project_id == project_id)
    if article_ids:
        ids = [UUID(id_str) for id_str in article_ids.split(",")]
        query = query.where(Article.id.in_(ids))
    articles = session.exec(query).all()
    return export_json_logic(project, articles, session)

@router.get("/{project_id}/export/csv")
def export_project_csv(project_id: UUID, article_ids: Optional[str] = None, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found or access denied")
    query = select(Article).where(Article.project_id == project_id)
    if article_ids:
        ids = [UUID(id_str) for id_str in article_ids.split(",")]
        query = query.where(Article.id.in_(ids))
    articles = session.exec(query).all()
    csv_content = export_csv_logic(project, articles, session)
    return StreamingResponse(iter([csv_content]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=project_export_{project_id}.csv"})

@router.get("/{project_id}/export/report")
def export_project_report(project_id: UUID, article_ids: Optional[str] = None, format: str = "md", org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found or access denied")
    query = select(Article).where(Article.project_id == project_id)
    if article_ids:
        ids = [UUID(id_str) for id_str in article_ids.split(",")]
        query = query.where(Article.id.in_(ids))
    query = query.order_by(desc(Article.created_at))
    articles = session.exec(query).all()
    report_content = generate_report_markdown(project, articles, session, (project.export_config or {}).get("report", {}))
    if format == "pdf":
        try:
            pdf_bytes = markdown_to_pdf_typst(report_content, project.name)
            return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=report_{project_id}.pdf"})
        except Exception as e: print(f"PDF generation failed: {e}")
    return StreamingResponse(io.BytesIO(report_content.encode("utf-8")), media_type="text/markdown", headers={"Content-Disposition": f"attachment; filename=report_{project_id}.md"})

# API Key Management
@router.get("/{project_id}/api-keys", response_model=List[ApiKeyRead])
def list_api_keys(project_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    return session.exec(select(ApiKey).where(ApiKey.project_id == project_id)).all()

@router.post("/{project_id}/api-keys", response_model=ApiKeyRead)
def create_api_key(project_id: UUID, data: ApiKeyCreate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    new_key = ApiKey(name=data.name, key=f"ltk_{secrets.token_urlsafe(32)}", project_id=project_id, org_id=org_id)
    session.add(new_key)
    session.commit()
    session.refresh(new_key)
    return new_key

@router.delete("/api-keys/{key_id}")
def delete_api_key(key_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    key = session.exec(select(ApiKey).where(ApiKey.id == key_id).where(ApiKey.org_id == org_id)).first()
    if not key: raise HTTPException(status_code=404, detail="API Key not found")
    session.delete(key)
    session.commit()
    return {"message": "API Key deleted"}

# Public External Export
@router.get("/external/export")
def external_export(
    project_id: UUID = Query(...), format: str = Query("json"), 
    auth_data: dict = Depends(get_org_id_from_api_key), session: Session = Depends(get_session)
):
    if str(project_id) != str(auth_data["project_id"]): raise HTTPException(status_code=403, detail="API key is not authorized for this project")
    project = session.get(Project, project_id)
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    articles = session.exec(select(Article).where(Article.project_id == project_id).order_by(desc(Article.created_at))).all()
    if format == "json": return export_json_logic(project, articles, session)
    elif format == "csv":
        csv_content = export_csv_logic(project, articles, session)
        return StreamingResponse(iter([csv_content]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=export_{project_id}.csv"})
    elif format in ["md", "pdf"]:
        report_content = generate_report_markdown(project, articles, session, (project.export_config or {}).get("report", {}))
        if format == "pdf":
            try:
                pdf_bytes = markdown_to_pdf_typst(report_content, project.name)
                return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=report_{project_id}.pdf"})
            except: pass
        return StreamingResponse(io.BytesIO(report_content.encode("utf-8")), media_type="text/markdown", headers={"Content-Disposition": f"attachment; filename=report_{project_id}.md"})
    raise HTTPException(status_code=400, detail="Invalid format")

@router.post("/{project_id}/export/report-preview")
def preview_project_report(project_id: UUID, report_config: dict, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found or access denied")
    articles = session.exec(select(Article).where(Article.project_id == project_id).order_by(desc(Article.created_at)).limit(5)).all()
    return {"markdown": generate_report_markdown(project, articles, session, report_config)}
