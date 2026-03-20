from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime, timezone
from models import Member, Organization, MemberInvite, MemberUpdate
from utils.auth0_utils import auth0_request, invite_to_org, remove_from_org, get_org_details, list_org_invitations, delete_org_invitation
from auth import get_current_org_id, get_current_user_id
import utils.auth0_utils as auth0
from pydantic import BaseModel

router = APIRouter(prefix="/api/orgs", tags=["organizations"])

class Invitation(BaseModel):
    id: str
    email: str
    inviter_name: str
    created_at: datetime
    expires_at: datetime

@router.get("/current", response_model=Organization)
def get_current_org(org_id: str = Depends(get_current_org_id)):
    details = auth0.get_org_details(org_id)
    created_at_str = details.get("created_at")
    if created_at_str:
        created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
    else:
        created_at = datetime.now(timezone.utc)

    return Organization(
        id=details["id"],
        name=details["name"],
        display_name=details["display_name"],
        logo_url=details.get("branding", {}).get("logo_url"),
        created_at=created_at
    )

@router.get("/members", response_model=List[Member])
def list_members(org_id: str = Depends(get_current_org_id)):
    auth0_members = auth0.auth0_request("GET", f"organizations/{org_id}/members")
    members = []
    for m in auth0_members:
        user_id = m["user_id"]
        try:
            full_profile = auth0.auth0_request("GET", f"users/{user_id}")
            last_login_str = full_profile.get("last_login")
            last_login = datetime.fromisoformat(last_login_str.replace("Z", "+00:00")) if last_login_str else None
        except:
            last_login = None

        members.append(Member(
            id=user_id,
            name=m.get("name") or m.get("nickname", "User"),
            email=m["email"],
            picture=m.get("picture"),
            status="active",
            last_login=last_login,
            joined_at=None
        ))
    return members

@router.get("/invitations", response_model=List[Invitation])
def get_invitations(org_id: str = Depends(get_current_org_id)):
    invites = list_org_invitations(org_id)
    return [
        Invitation(
            id=i["id"],
            email=i["invitee"]["email"],
            inviter_name=i["inviter"]["name"],
            created_at=datetime.fromisoformat(i["created_at"].replace("Z", "+00:00")),
            expires_at=datetime.fromisoformat(i["expires_at"].replace("Z", "+00:00"))
        ) for i in invites
    ]

@router.post("/members/invite", response_model=Member)
def invite_member(
    invite: MemberInvite, 
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id)
):
    inviter = auth0.auth0_request("GET", f"users/{user_id}")
    inviter_name = inviter.get("name") or inviter.get("nickname", "Admin")
    result = auth0.invite_to_org(org_id, invite.email, [], inviter_name)
    
    return Member(
        id=result.get("id", "pending"),
        name="Invited User",
        email=invite.email,
        status="invited",
        last_login=None,
        joined_at=datetime.now(timezone.utc)
    )

@router.post("/invitations/{invitation_id}/resend")
def resend_invitation(
    invitation_id: str,
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id)
):
    # 1. Get original invitation to find email
    invites = list_org_invitations(org_id)
    target = next((i for i in invites if i["id"] == invitation_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    email = target["invitee"]["email"]
    
    # 2. Delete old one
    delete_org_invitation(org_id, invitation_id)
    
    # 3. Create new one
    inviter = auth0.auth0_request("GET", f"users/{user_id}")
    inviter_name = inviter.get("name") or inviter.get("nickname", "Admin")
    auth0.invite_to_org(org_id, email, [], inviter_name)
    
    return {"status": "success"}

@router.delete("/invitations/{invitation_id}")
def revoke_invitation(invitation_id: str, org_id: str = Depends(get_current_org_id)):
    delete_org_invitation(org_id, invitation_id)
    return {"status": "success"}

@router.delete("/members/{member_id}")
def remove_member(member_id: str, org_id: str = Depends(get_current_org_id)):
    auth0.remove_from_org(org_id, member_id)
    return {"status": "success"}
