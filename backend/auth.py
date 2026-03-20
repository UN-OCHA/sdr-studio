import os
import json
from typing import Optional
from fastapi import Depends, HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from jose import jwt
from curl_cffi import requests
from dotenv import load_dotenv
from sqlmodel import Session, select
from datetime import datetime, timezone

load_dotenv()

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE")
ORG_ID_CLAIM = os.getenv("AUTH0_ORG_ID_CLAIM", "https://sdr-studio.com/org_id")
# Fallback secret for local dev if not in .env
APP_SECRET = os.getenv("APP_SECRET", "LTK_LOCAL_DEVELOPMENT_SECRET_KEY_CHANGE_IN_PROD")

security = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# In-memory cache for JWKS to avoid fetching on every request
_jwks_cache = None

def get_jwks():
    global _jwks_cache
    if _jwks_cache is None:
        try:
            jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
            response = requests.get(jwks_url)
            _jwks_cache = response.json()
        except Exception as e:
            print(f"Error fetching JWKS: {e}")
            return None
    return _jwks_cache

def create_export_token(org_id: str) -> str:
    from datetime import datetime, timedelta, timezone
    expire = datetime.now(timezone.utc) + timedelta(seconds=60)
    to_encode = {"org_id": org_id, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, APP_SECRET, algorithm="HS256")
    return encoded_jwt

def verify_export_token(token: str) -> str:
    try:
        payload = jwt.decode(token, APP_SECRET, algorithms=["HS256"])
        org_id: str = payload.get("org_id")
        if org_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid export token")
        return org_id
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Expired or invalid export token")

def get_current_org_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    token: Optional[str] = None
) -> str:
    # Prefer Bearer token from header
    if credentials:
        auth_token = credentials.credentials
        try:
            # Fetch JWKS (cached)
            jwks = get_jwks()
            if not jwks:
                raise Exception("Could not retrieve JWKS from Auth0")
            
            unverified_header = jwt.get_unverified_header(auth_token)
            rsa_key = {}
            for key in jwks["keys"]:
                if key["kid"] == unverified_header["kid"]:
                    rsa_key = {
                        "kty": key["kty"],
                        "kid": key["kid"],
                        "use": key["use"],
                        "n": key["n"],
                        "e": key["e"]
                    }
            
            if rsa_key:
                payload = jwt.decode(
                    auth_token,
                    rsa_key,
                    algorithms=["RS256"],
                    audience=AUTH0_AUDIENCE,
                    issuer=f"https://{AUTH0_DOMAIN}/"
                )
                
                # Extract org_id from custom claim or fallback to 'public' for now
                org_id = payload.get(ORG_ID_CLAIM)
                if not org_id:
                    # Fallback to 'sub' if no org_id claim exists (as a safety measure)
                    org_id = payload.get("sub", "public")
                
                return org_id
        except Exception as e:
            # Clear cache on error to allow retry on next request
            global _jwks_cache
            _jwks_cache = None
            
            print(f"Auth error (Bearer): {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid authentication credentials: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # Fallback to short-lived 'token' query parameter (for exports)
    if token:
        return verify_export_token(token)
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> str:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    auth_token = credentials.credentials
    try:
        jwks = get_jwks()
        unverified_header = jwt.get_unverified_header(auth_token)
        rsa_key = {}
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {"kty": key["kty"], "kid": key["kid"], "use": key["use"], "n": key["n"], "e": key["e"]}
        
        if rsa_key:
            payload = jwt.decode(auth_token, rsa_key, algorithms=["RS256"], audience=AUTH0_AUDIENCE, issuer=f"https://{AUTH0_DOMAIN}/")
            return payload.get("sub")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(e)}")
    return None

def get_org_id_from_api_key(
    api_key: str = Security(api_key_header)
) -> dict:
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API Key",
        )
    
    from database import engine
    from models import ApiKey
    with Session(engine) as session:
        db_key = session.exec(select(ApiKey).where(ApiKey.key == api_key)).first()
        if not db_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API Key",
            )
        
        # Update last used
        db_key.last_used = datetime.now(timezone.utc)
        session.add(db_key)
        session.commit()
        
        return {"org_id": db_key.org_id, "project_id": db_key.project_id}
