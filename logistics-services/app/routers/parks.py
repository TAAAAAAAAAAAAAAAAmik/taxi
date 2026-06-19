from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models import DispatchEvent, ParkDriver, ParkVehicle
from app.schemas import ParkDashboardResponse, ParkInviteRequest, ParkVehicleRequest, RoleRegistrationResponse
from app.services.billing import BillingService
from app.services.roles import RoleService

router = APIRouter(prefix="/parks", tags=["parks"])


@router.get("/{park_id}/dashboard", response_model=ParkDashboardResponse)
async def park_dashboard(
    park_id: str,
    session: AsyncSession = Depends(get_session),
) -> ParkDashboardResponse:
    """Return taxi park cabinet summary for dashboard widgets."""

    active_drivers = await session.scalar(
        select(func.count()).select_from(ParkDriver).where(
            ParkDriver.park_id == park_id,
            ParkDriver.status == "active",
        ),
    )
    orders_total = await session.scalar(
        select(func.count()).select_from(DispatchEvent).where(
            DispatchEvent.payload["parkId"].as_string() == park_id,
            DispatchEvent.event_type == "assigned",
        ),
    )
    subscription = await BillingService(session).subscription_status(park_id=park_id)
    return ParkDashboardResponse(
        active_drivers=int(active_drivers or 0),
        commission_amount=Decimal("0.00"),
        orders_total=int(orders_total or 0),
        park_id=park_id,
        revenue=Decimal("0.00"),
        subscription_active=subscription.active,
    )


@router.post("/{park_id}/drivers/invite", response_model=RoleRegistrationResponse)
async def invite_park_driver(
    park_id: str,
    payload: ParkInviteRequest,
    session: AsyncSession = Depends(get_session),
) -> RoleRegistrationResponse:
    """Create a taxi park driver invite code."""

    try:
        return await RoleService(session).create_driver_invite(park_id, payload)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/{park_id}/drivers")
async def park_drivers(
    park_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, list[dict[str, object]]]:
    """List taxi park driver memberships."""

    result = await session.scalars(select(ParkDriver).where(ParkDriver.park_id == park_id))
    return {
        "drivers": [
            {
                "driver_id": item.driver_id,
                "invite_code": item.invite_code,
                "status": item.status,
                "user_id": item.user_id,
            }
            for item in result
        ],
    }


@router.post("/{park_id}/vehicles")
async def add_park_vehicle(
    park_id: str,
    payload: ParkVehicleRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Add a vehicle to a taxi park."""

    vehicle = await RoleService(session).add_vehicle(park_id, payload)
    return {"vehicle_id": vehicle.id, "status": vehicle.status}


@router.get("/{park_id}/vehicles")
async def park_vehicles(
    park_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, list[dict[str, object]]]:
    """List taxi park vehicles."""

    result = await session.scalars(select(ParkVehicle).where(ParkVehicle.park_id == park_id))
    return {
        "vehicles": [
            {
                "brand": vehicle.brand,
                "driver_id": vehicle.driver_id,
                "id": vehicle.id,
                "model": vehicle.model,
                "plate": vehicle.plate,
                "status": vehicle.status,
            }
            for vehicle in result
        ],
    }


@router.get("/{park_id}/orders")
async def park_orders(park_id: str, session: AsyncSession = Depends(get_session)) -> dict[str, list[dict]]:
    """Return dispatch events that belong to a taxi park."""

    result = await session.scalars(
        select(DispatchEvent).where(DispatchEvent.payload["parkId"].as_string() == park_id),
    )
    return {"orders": [event.payload for event in result]}


@router.get("/{park_id}/finance")
async def park_finance(park_id: str, session: AsyncSession = Depends(get_session)) -> dict[str, object]:
    """Return finance summary for a taxi park."""

    subscription = await BillingService(session).subscription_status(park_id=park_id)
    return {
        "commission_amount": "0.00",
        "park_id": park_id,
        "subscription": subscription.model_dump(mode="json"),
    }
