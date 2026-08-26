from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.base import User
from app.schemas.user import Token, UserCreate, UserLogin, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if email exists
    existing_res = await db.execute(select(User).where(User.email == user_in.email.lower()))
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already registered",
        )

    # Normalize role to CUSTOMER / ORGANISER / ADMIN
    role_raw = (user_in.role or "CUSTOMER").upper()
    role_map = {
        "USER": "CUSTOMER",
        "CUSTOMER": "CUSTOMER",
        "THEATRE_ADMIN": "ORGANISER",
        "ORGANISER": "ORGANISER",
        "SUPER_ADMIN": "ADMIN",
        "ADMIN": "ADMIN",
    }
    role = role_map.get(role_raw, "CUSTOMER")

    user = User(
        email=user_in.email.lower(),
        name=user_in.name,
        password=get_password_hash(user_in.password),
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(subject=user.id, role=user.role)
    return Token(token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=Token)
async def login(user_in: UserLogin, db: AsyncSession = Depends(get_db)):
    user_res = await db.execute(select(User).where(User.email == user_in.email.lower()))
    user = user_res.scalar_one_or_none()

    if not user or not verify_password(user_in.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(subject=user.id, role=user.role)
    return Token(token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
