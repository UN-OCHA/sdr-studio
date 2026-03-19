from fastapi import APIRouter, Depends
from auth import get_current_org_id, create_export_token

router = APIRouter(tags=["auth"])

@router.post("/api/export-token")
def get_export_token(org_id: str = Depends(get_current_org_id)):
    token = create_export_token(org_id)
    return {"token": token}
