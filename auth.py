import os
import requests
from jose import jwt, jwk
from jose.exceptions import JOSEError
from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from database import SessionLocal, User

# Load configuration from environment variables
TENANT_ID = os.getenv("TENANT_ID")
CLIENT_ID = os.getenv("CLIENT_ID")

# Construct the metadata URL for Azure AD
METADATA_URL = f"https://login.microsoftonline.com/{TENANT_ID}/v2.0/.well-known/openid-configuration"

# --- JWKS (JSON Web Key Set) Caching ---
jwks_cache = {}

def get_jwks():
    """
    Fetches and caches the JWKS from Microsoft's metadata endpoint.
    """
    global jwks_cache
    if jwks_cache:
        return jwks_cache

    try:
        response = requests.get(METADATA_URL)
        response.raise_for_status()
        metadata = response.json()
        
        jwks_uri = metadata.get("jwks_uri")
        if not jwks_uri:
            raise JOSEError("jwks_uri not found in OpenID Connect metadata.")

        jwks_response = requests.get(jwks_uri)
        jwks_response.raise_for_status()
        jwks_cache = jwks_response.json()
        return jwks_cache
    except requests.RequestException as e:
        raise JOSEError(f"Failed to fetch OpenID Connect metadata or JWKS: {e}")


def get_signing_key(token: str):
    """
    Finds the appropriate signing key from the JWKS based on the token's header.
    """
    try:
        jwks = get_jwks()
        unverified_header = jwt.get_unverified_header(token)
        rsa_key = {}
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"],
                    "alg": "RS256"
                }
                break
        if not rsa_key:
            raise JOSEError("Signing key not found in JWKS.")
        
        return jwk.construct(rsa_key)
    except (KeyError, IndexError) as e:
        raise JOSEError(f"Token header is invalid or malformed: {e}")


async def verify_token(request: Request) -> dict:
    """
    Verifies the Azure AD JWT token from the Authorization header.
    """
    global jwks_cache
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Authorization header is missing")

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")

    token = parts[1]
    
    last_exception = None

    for attempt in range(2):
        try:
            signing_key = get_signing_key(token)
            
            payload = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                audience=f"api://{CLIENT_ID}"
            )
            return payload
        except JOSEError as e:
            last_exception = e
            if "Signature verification failed" in str(e) and attempt == 0:
                jwks_cache = {}
                continue
            else:
                raise HTTPException(status_code=401, detail=f"Token validation failed: {e}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"An unexpected error occurred during token validation: {e}")
    
    if last_exception:
        raise HTTPException(status_code=401, detail=f"Token validation failed after retry: {last_exception}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    payload = await verify_token(request)
    
    # Try to find a user identifier from common claims
    username = payload.get("preferred_username") or payload.get("upn") or payload.get("email")
    
    if username is None:
        raise HTTPException(status_code=400, detail="Token does not contain a valid username claim (preferred_username, upn, or email)")

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        user = User(username=username)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
