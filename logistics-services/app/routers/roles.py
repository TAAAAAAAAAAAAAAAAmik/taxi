from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas import (
    ParkDriverRegistrationRequest,
    ParkRegistrationRequest,
    RoleRegistrationResponse,
    SelfEmployedRegistrationRequest,
)
from app.services.roles import RoleService

router = APIRouter(prefix="/roles", tags=["roles"])


@router.post("/self-employed-drivers", response_model=RoleRegistrationResponse)
async def register_self_employed_driver(
    payload: SelfEmployedRegistrationRequest,
    session: AsyncSession = Depends(get_session),
) -> RoleRegistrationResponse:
    """Register a self-employed driver profile for document verification."""

    return await RoleService(session).register_self_employed_driver(payload)


@router.post("/parks", response_model=RoleRegistrationResponse)
async def register_park(
    payload: ParkRegistrationRequest,
    session: AsyncSession = Depends(get_session),
) -> RoleRegistrationResponse:
    """Register a taxi park legal profile."""

    return await RoleService(session).register_park(payload)


@router.post("/park-drivers", response_model=RoleRegistrationResponse)
async def register_park_driver(
    payload: ParkDriverRegistrationRequest,
    session: AsyncSession = Depends(get_session),
) -> RoleRegistrationResponse:
    """Register a taxi park driver by invite code."""

    try:
        return await RoleService(session).register_park_driver(payload)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
