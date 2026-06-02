from fastapi import APIRouter, Depends, HTTPException
from redis.asyncio import Redis
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.redis import get_redis
from app.models import AddressPoint, new_id
from app.schemas import AddressImportRequest, AddressImportResponse, AddressPointRequest, AddressPointResponse
from app.services.address_loader import AddressLoaderService

router = APIRouter(prefix="/addresses", tags=["addresses"])


@router.post("/import/salavat", response_model=AddressImportResponse)
async def import_salavat_addresses(
    payload: AddressImportRequest,
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
) -> AddressImportResponse:
    """Manually import missing Salavat district addresses from GAR/FIAS and OSM."""

    return await AddressLoaderService(session, redis).import_salavat(payload)


@router.get("", response_model=list[AddressPointResponse])
async def list_addresses(session: AsyncSession = Depends(get_session)) -> list[AddressPointResponse]:
    """Return manually editable address points for the admin panel."""

    result = await session.scalars(select(AddressPoint).order_by(AddressPoint.updated_at.desc()).limit(500))
    return [_address_response(point) for point in result]


@router.post("", response_model=AddressPointResponse)
async def create_address(
    payload: AddressPointRequest,
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
) -> AddressPointResponse:
    """Create a manual street, house, or POI and index it for suggestions."""

    point = AddressPoint(
        contract_status=payload.contract_status,
        full_address=payload.full_address,
        house_number=payload.house_number,
        id=new_id("addr"),
        latitude=payload.latitude,
        longitude=payload.longitude,
        marketer_id=payload.marketer_id,
        normalized_key=_normalized_key(payload),
        qr_code_id=payload.qr_code_id,
        settlement=payload.settlement,
        source="admin",
        source_id=payload.source_id or new_id("manual"),
        street=payload.street,
    )
    session.add(point)
    await session.commit()
    await session.refresh(point)
    await _index_address(redis, point)
    return _address_response(point)


@router.patch("/{address_id}", response_model=AddressPointResponse)
async def update_address(
    address_id: str,
    payload: AddressPointRequest,
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
) -> AddressPointResponse:
    """Edit an address point and refresh search suggestions immediately."""

    point = await session.get(AddressPoint, address_id)
    if point is None:
        raise HTTPException(status_code=404, detail="Address not found")

    point.contract_status = payload.contract_status
    point.full_address = payload.full_address
    point.house_number = payload.house_number
    point.latitude = payload.latitude
    point.longitude = payload.longitude
    point.marketer_id = payload.marketer_id
    point.normalized_key = _normalized_key(payload)
    point.qr_code_id = payload.qr_code_id
    point.settlement = payload.settlement
    point.street = payload.street
    await session.commit()
    await session.refresh(point)
    await _index_address(redis, point)
    return _address_response(point)


@router.delete("/{address_id}")
async def delete_address(
    address_id: str,
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
) -> dict[str, bool]:
    """Delete a manual address point and remove its Redis suggestion payload."""

    await session.execute(delete(AddressPoint).where(AddressPoint.id == address_id))
    await session.commit()
    await redis.delete(f"addresses:point:{address_id}")
    return {"ok": True}


def _normalized_key(payload: AddressPointRequest) -> str:
    return "|".join(
        [
            payload.settlement.strip().lower(),
            payload.street.strip().lower(),
            payload.house_number.strip().lower(),
            payload.full_address.strip().lower(),
        ],
    )


async def _index_address(redis: Redis, point: AddressPoint) -> None:
    await redis.hset(
        f"addresses:point:{point.id}",
        mapping={
            "full_address": point.full_address,
            "id": point.id,
            "latitude": str(point.latitude or ""),
            "longitude": str(point.longitude or ""),
            "settlement": point.settlement,
            "street": point.street,
        },
    )


def _address_response(point: AddressPoint) -> AddressPointResponse:
    return AddressPointResponse(
        contract_status=point.contract_status,
        full_address=point.full_address,
        house_number=point.house_number,
        id=point.id,
        install_count=point.install_count,
        latitude=point.latitude,
        longitude=point.longitude,
        marketer_id=point.marketer_id,
        qr_code_id=point.qr_code_id,
        settlement=point.settlement,
        source=point.source,
        street=point.street,
        updated_at=point.updated_at,
    )
