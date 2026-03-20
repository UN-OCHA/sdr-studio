import os
import time
from typing import List, Dict, Any, Optional
from curl_cffi import requests
from fastapi import HTTPException, status

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_MGMT_CLIENT_ID = os.getenv("AUTH0_MANAGEMENT_CLIENT_ID")
AUTH0_MGMT_CLIENT_SECRET = os.getenv("AUTH0_MANAGEMENT_CLIENT_SECRET")

_token_cache = {
    "access_token": None,
    "expires_at": 0
}

def get_mgmt_token() -> str:
    global _token_cache
    now = time.time()
    
    if _token_cache["access_token"] and _token_cache["expires_at"] > now + 60:
        return _token_cache["access_token"]
    
    if not all([AUTH0_DOMAIN, AUTH0_MGMT_CLIENT_ID, AUTH0_MGMT_CLIENT_SECRET]):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Auth0 Management API credentials not configured"
        )
    
    url = f"https://{AUTH0_DOMAIN}/oauth/token"
    payload = {
        "client_id": AUTH0_MGMT_CLIENT_ID,
        "client_secret": AUTH0_MGMT_CLIENT_SECRET,
        "audience": f"https://{AUTH0_DOMAIN}/api/v2/",
        "grant_type": "client_credentials"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        if response.status_code != 200:
            print(f"Auth0 Token Error: {response.status_code} - {response.text}")
        response.raise_for_status()
        data = response.json()
        
        _token_cache["access_token"] = data["access_token"]
        _token_cache["expires_at"] = now + data["expires_in"]
        return _token_cache["access_token"]
    except Exception as e:
        print(f"Error fetching Auth0 Management token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not authenticate with Auth0 Management API"
        )

def auth0_request(method: str, path: str, json_data: Any = None) -> Any:
    token = get_mgmt_token()
    url = f"https://{AUTH0_DOMAIN}/api/v2/{path.lstrip('/')}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.request(method, url, json=json_data, headers=headers, timeout=15)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        if response.status_code == 204:
            return True
        return response.json()
    except Exception as e:
        print(f"Auth0 API error [{method} {path}]: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Auth0 Management API error: {str(e)}"
        )

# -- Organization Methods --

def get_org_details(org_id: str) -> Dict[str, Any]:
    return auth0_request("GET", f"organizations/{org_id}")

def list_org_members(org_id: str) -> List[Dict[str, Any]]:
    # This gets members of the organization
    members = auth0_request("GET", f"organizations/{org_id}/members")
    # For each member, we might want their roles within the org
    for member in members:
        roles = auth0_request("GET", f"organizations/{org_id}/members/{member['user_id']}/roles")
        member['roles'] = roles
    return members

def invite_to_org(org_id: str, email: str, role_ids: List[str], inviter_name: str) -> Dict[str, Any]:
    payload = {
        "inviter": {"name": inviter_name},
        "invitee": {"email": email},
        "client_id": os.getenv("AUTH0_CLIENT_ID"), # Application client ID
        "roles": role_ids,
        "send_invitation_email": True
    }
    return auth0_request("POST", f"organizations/{org_id}/invitations", json_data=payload)

def remove_from_org(org_id: str, user_id: str):
    return auth0_request("DELETE", f"organizations/{org_id}/members", json_data={"ids": [user_id]})

def list_org_invitations(org_id: str) -> List[Dict[str, Any]]:
    return auth0_request("GET", f"organizations/{org_id}/invitations")

def delete_org_invitation(org_id: str, invitation_id: str):
    return auth0_request("DELETE", f"organizations/{org_id}/invitations/{invitation_id}")

# -- User Methods --

def get_user_sessions(user_id: str) -> List[Dict[str, Any]]:
    # Note: Sessions API might require specific Auth0 plan/settings
    # Fallback: return login activity if sessions not available
    try:
        return auth0_request("GET", f"users/{user_id}/sessions")
    except:
        return []

def revoke_session(session_id: str):
    return auth0_request("DELETE", f"sessions/{session_id}")

def trigger_password_reset(email: str):
    # This is actually an Authentication API call, not Management API
    url = f"https://{AUTH0_DOMAIN}/dbconnections/change_password"
    payload = {
        "client_id": os.getenv("AUTH0_CLIENT_ID"),
        "email": email,
        "connection": "Username-Password-Authentication" # Default connection name
    }
    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"Error triggering password reset: {e}")
        return False
