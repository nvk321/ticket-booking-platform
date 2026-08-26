from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.base import SeatType, Show, User, Waitlist
from app.schemas.waitlist import WaitlistJoinRequest, WaitlistResponse
from app.services.waitlist_service import waitlist_service

router = APIRouter(prefix="/waitlist", tags=["Waitlists"])


@router.post("/join", status_code=status.HTTP_201_CREATED)
async def join_waitlist(
    req: WaitlistJoinRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await waitlist_service.join_waitlist(
            db=db,
            user_id=current_user.id,
            show_id=req.show_id,
            seat_type_id=req.seat_type_id,
        )
        return result
    except ValueError as e:
        err_msg = str(e).lower()
        if "already on the active waitlist" in err_msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Waitlist entry conflict.")


@router.get("/my")
async def get_my_waitlists(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await waitlist_service.get_user_waitlists(db=db, user_id=current_user.id)


@router.post("/{id}/claim")
async def claim_waitlist_offer(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        booking = await waitlist_service.claim_waitlist_offer(
            db=db,
            user_id=current_user.id,
            waitlist_id=id,
        )
        return {"message": "Waitlist offer claimed successfully", "booking": booking}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{id}/leave")
async def leave_waitlist(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await waitlist_service.leave_waitlist(
            db=db,
            user_id=current_user.id,
            waitlist_id=id,
        )
        return {"success": True, "message": "Successfully left the waitlist"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/show/{show_id}")
async def get_show_waitlist_summary(
    show_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(
            Waitlist.seat_type_id,
            SeatType.name,
            func.count(Waitlist.id).label("count")
        )
        .join(SeatType, Waitlist.seat_type_id == SeatType.id)
        .where(Waitlist.show_id == show_id, Waitlist.status == "PENDING")
        .group_by(Waitlist.seat_type_id, SeatType.name)
    )
    rows = res.all()
    return [{"seatTypeId": r[0], "seatTypeName": r[1], "waitlistCount": r[2]} for r in rows]
