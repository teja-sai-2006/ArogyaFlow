from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import User, Hospital
from auth.jwt_utils import verify_password, create_access_token
from auth.rbac_guard import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

@router.post("/login", response_model=LoginResponse)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == creds.email).first()
    if not user or not verify_password(creds.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Attach hospital / org info if available
    org_name = None
    if user.org_id:
        hosp = db.query(Hospital).filter(Hospital.id == user.org_id).first()
        if hosp:
            org_name = hosp.name

    token_data = {
        "user_id": user.id,
        "role": user.role,
        "org_id": user.org_id,
        "uhid": user.uhid,
        "name": user.name,
        "email": user.email
    }
    token = create_access_token(token_data)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "role": user.role,
            "org_id": user.org_id,
            "org_name": org_name,
            "uhid": user.uhid,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "blood_group": user.blood_group,
            "allergies": user.allergies
        }
    }

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "role": current_user.role,
        "org_id": current_user.org_id,
        "uhid": current_user.uhid,
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone,
        "blood_group": current_user.blood_group,
        "allergies": current_user.allergies
    }

@router.get("/demo-users")
def get_demo_users(db: Session = Depends(get_db)):
    """Returns seeded accounts across all 8 roles for the Quick Demo Role Switcher"""
    users = db.query(User).all()
    result = []
    for u in users:
        result.append({
            "id": u.id,
            "name": u.name,
            "role": u.role,
            "org_id": u.org_id,
            "uhid": u.uhid,
            "email": u.email,
            "blood_group": u.blood_group
        })
    return result
