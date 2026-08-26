from typing import Callable, List, Optional
from fastapi import Depends, HTTPException, Header, Path, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.base import Theatre, User, UserRole

security_scheme = HTTPBearer(auto_error=False)

ROLE_ALIASES = {
    "ADMIN": ["ADMIN", "SUPER_ADMIN"],
    "ORGANISER": ["ORGANISER", "THEATRE_ADMIN", "ADMIN", "SUPER_ADMIN"],
    "CUSTOMER": ["CUSTOMER", "USER", "ORGANISER", "THEATRE_ADMIN", "ADMIN", "SUPER_ADMIN"],
}


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    if not payload or "userId" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token or token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_res = await db.execute(select(User).where(User.id == payload["userId"]))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists",
        )

    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload or "userId" not in payload:
        return None
    user_res = await db.execute(select(User).where(User.id == payload["userId"]))
    return user_res.scalar_one_or_none()


def require_role(*allowed_roles: str) -> Callable:
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = current_user.role.upper()
        # Normalize
        is_allowed = False
        for role in allowed_roles:
            role_upper = role.upper()
            allowed_group = ROLE_ALIASES.get(role_upper, [role_upper])
            if user_role in allowed_group:
                is_allowed = True
                break

        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Requires one of [{', '.join(allowed_roles)}] permissions",
            )
        return current_user

    return role_checker
