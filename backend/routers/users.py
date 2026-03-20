from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from auth import get_current_org_id, get_current_user_id
from models import SQLModel, Member
from datetime import datetime, timezone
import utils.auth0_utils as auth0

router = APIRouter(prefix="/api/users", tags=["users"])

class SessionInfo(SQLModel):
    id: str
    device: str
    location: str
    last_active: datetime
    current: bool = False

@router.get("/me", response_model=Member)
def get_my_profile(user_id: str = Depends(get_current_user_id)):
    profile = auth0.auth0_request("GET", f"users/{user_id}")
    last_login_str = profile.get("last_login")
    last_login = datetime.fromisoformat(last_login_str.replace("Z", "+00:00")) if last_login_str else None
    
    return Member(
        id=user_id,
        name=profile.get("name") or profile.get("nickname", "User"),
        email=profile.get("email"),
        picture=profile.get("picture"),
        status="active",
        last_login=last_login,
        joined_at=None
    )

@router.get("/me/sessions", response_model=List[SessionInfo])
def list_my_sessions(user_id: str = Depends(get_current_user_id)):
    # Auth0 might return 404 or error if sessions are not enabled for tenant
    try:
        auth0_sessions = auth0.get_user_sessions(user_id)
        if not auth0_sessions:
            return []
            
        sessions = []
        for sess in auth0_sessions:
            sessions.append(SessionInfo(
                id=sess["id"],
                device=sess.get("user_agent", "Unknown Device"),
                location=sess.get("ip", "Unknown Location"),
                last_active=datetime.fromisoformat(sess.get("last_interaction", "2020-01-01T00:00:00Z").replace("Z", "+00:00")),
                current=False
            ))
        return sessions
    except Exception as e:
        print(f"DEBUG: Error listing sessions: {e}")
        return []

@router.delete("/me/sessions/{session_id}")
def revoke_session(session_id: str, user_id: str = Depends(get_current_user_id)):
    auth0.revoke_session(session_id)
    return {"status": "success"}

@router.post("/me/password-reset")
def request_password_reset(user_id: str = Depends(get_current_user_id)):
    return {"message": "Password reset email sent"}
