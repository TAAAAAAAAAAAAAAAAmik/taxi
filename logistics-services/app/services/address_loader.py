import asyncio
import json
import re
import zipfile
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Iterable
from xml.etree import ElementTree

import httpx
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.models import AddressPoint
from app.schemas import AddressImportRequest, AddressImportResponse

SALAVAT_MARKERS = ("салават", "малояз", "янгантау", "мурсалимкино", "аркаул", "лаклы")
OVERPASS_QUERY = """
[out:json][timeout:180];
area({area_id})->.a;
(
  node(area.a)["addr:housenumber"];
  way(area.a)["addr:housenumber"];
  relation(area.a)["addr:housenumber"];
);
out tags center;
"""


@dataclass(frozen=True)
class AddressRecord:
    """Normalized imported address candidate."""

    source: str
    source_id: str
    normalized_key: str
    settlement: str
    street: str
    house_number: str
    full_address: str
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    fias_object_guid: str | None = None
    osm_type: str | None = None
    osm_id: str | None = None


class AddressLoaderService:
    """Load missing Salavat district addresses from GAR/FIAS and OSM."""

    def __init__(
        self,
        session: AsyncSession,
        redis: Redis,
        settings: Settings | None = None,
    ) -> None:
        self.session = session
        self.redis = redis
        self.settings = settings or get_settings()

    async def import_salavat(self, request: AddressImportRequest) -> AddressImportResponse:
        """Import Salavat district addresses incrementally and update Redis GEO."""

        gar_records: list[AddressRecord] = []
        osm_records: list[AddressRecord] = []

        if request.include_gar:
            gar_records = await self.load_gar_records()
        if request.include_osm:
            osm_records = await self.load_osm_records()

        records = self._dedupe_records([*gar_records, *osm_records])
        if request.max_records:
            records = records[: request.max_records]

        added = 0
        skipped_existing = 0
        redis_indexed = 0

        for record in records:
            exists = await self.session.scalar(
                select(AddressPoint.id).where(AddressPoint.normalized_key == record.normalized_key),
            )
            if exists:
                skipped_existing += 1
                continue

            if request.dry_run:
                added += 1
                continue

            point = AddressPoint(
                source=record.source,
                source_id=record.source_id,
                normalized_key=record.normalized_key,
                settlement=record.settlement,
                street=record.street,
                house_number=record.house_number,
                full_address=record.full_address,
                latitude=record.latitude,
                longitude=record.longitude,
                fias_object_guid=record.fias_object_guid,
                osm_type=record.osm_type,
                osm_id=record.osm_id,
            )
            self.session.add(point)
            await self.session.flush()
            added += 1

            if record.latitude is not None and record.longitude is not None:
                await self.redis.execute_command(
                    "GEOADD",
                    self.settings.address_geo_key,
                    str(record.longitude),
                    str(record.latitude),
                    point.id,
                )
                redis_indexed += 1

        if not request.dry_run:
            await self.session.commit()

        return AddressImportResponse(
            added=added,
            dry_run=request.dry_run,
            gar_seen=len(gar_records),
            osm_seen=len(osm_records),
            redis_indexed=redis_indexed,
            skipped_existing=skipped_existing,
        )

    async def load_gar_records(self) -> list[AddressRecord]:
        """Load GAR/FIAS records from a configured local archive or the latest region archive."""

        archive_path = Path(self.settings.gar_archive_path) if self.settings.gar_archive_path else None
        if archive_path and archive_path.exists():
            return await asyncio.to_thread(self._parse_gar_archive, archive_path)

        archive_url = await self._latest_region_archive_url()
        if not archive_url:
            return []

        with NamedTemporaryFile(suffix=".zip", delete=False) as file:
            temp_path = Path(file.name)

        try:
            async with httpx.AsyncClient(timeout=180) as client:
                async with client.stream("GET", archive_url) as response:
                    response.raise_for_status()
                    with temp_path.open("wb") as output:
                        async for chunk in response.aiter_bytes():
                            output.write(chunk)
            return await asyncio.to_thread(self._parse_gar_archive, temp_path)
        finally:
            temp_path.unlink(missing_ok=True)

    async def load_osm_records(self) -> list[AddressRecord]:
        """Load OSM address points from Overpass with endpoint rotation."""

        query = OVERPASS_QUERY.format(area_id=self.settings.salavat_area_id)
        body = {"data": query}
        last_error: Exception | None = None

        for endpoint in self.settings.overpass_endpoints:
            try:
                async with httpx.AsyncClient(timeout=180) as client:
                    response = await client.post(endpoint, data=body)
                    response.raise_for_status()
                    return self._parse_osm_payload(response.json())
            except Exception as error:
                last_error = error
                await asyncio.sleep(1)

        if last_error:
            raise last_error
        return []

    async def _latest_region_archive_url(self) -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(self.settings.fias_download_info_url)
            response.raise_for_status()
            payload = response.json()

        return self._extract_region_archive_url(payload, self.settings.gar_region_code)

    @classmethod
    def _extract_region_archive_url(cls, payload: object, region_code: str) -> str:
        """Find a likely GAR archive URL for a region inside FIAS metadata."""

        candidates = payload if isinstance(payload, list) else payload.get("items", []) if isinstance(payload, dict) else []
        for item in candidates:
            if not isinstance(item, dict):
                continue
            serialized = json.dumps(item, ensure_ascii=False).lower()
            if f'"regioncode": "{region_code}"' not in serialized and f"_{region_code}_" not in serialized:
                continue
            for value in item.values():
                text = str(value)
                if text.lower().endswith(".zip") and text.startswith("http"):
                    return text
        return ""

    def _parse_gar_archive(self, archive_path: Path) -> list[AddressRecord]:
        """Parse a GAR/FIAS archive opportunistically for Salavat district houses."""

        records: list[AddressRecord] = []
        with zipfile.ZipFile(archive_path) as archive:
            house_files = [
                name
                for name in archive.namelist()
                if Path(name).name.upper().startswith("AS_HOUSES") and name.upper().endswith(".XML")
            ]
            for name in house_files:
                with archive.open(name) as file:
                    for _, element in ElementTree.iterparse(file, events=("end",)):
                        if self._local_name(element.tag) != "HOUSE":
                            continue
                        attrs = {key.upper(): value for key, value in element.attrib.items()}
                        house_number = attrs.get("HOUSENUM") or attrs.get("ADDNUM1") or ""
                        object_guid = attrs.get("OBJECTGUID") or attrs.get("OBJECTID") or attrs.get("ID") or ""
                        if not house_number or not self._looks_salavat(attrs):
                            element.clear()
                            continue

                        full_address = f"Салаватский район, дом {house_number}"
                        records.append(
                            AddressRecord(
                                source="gar",
                                source_id=object_guid or f"gar-house-{len(records)}",
                                normalized_key=self.normalized_key("Салаватский район", "", house_number),
                                settlement="",
                                street="",
                                house_number=house_number,
                                full_address=full_address,
                                fias_object_guid=object_guid or None,
                            ),
                        )
                        element.clear()
        return records

    @classmethod
    def _parse_osm_payload(cls, payload: dict) -> list[AddressRecord]:
        records: list[AddressRecord] = []
        for element in payload.get("elements", []):
            tags = element.get("tags") or {}
            house = str(tags.get("addr:housenumber") or "").strip()
            street = str(tags.get("addr:street") or tags.get("addr:place") or "").strip()
            settlement = str(tags.get("addr:city") or tags.get("addr:village") or tags.get("addr:hamlet") or "").strip()
            if not house:
                continue

            point = cls._element_point(element)
            source_id = f"{element.get('type')}:{element.get('id')}"
            full_address = cls.full_address(settlement, street, house)
            records.append(
                AddressRecord(
                    source="osm",
                    source_id=source_id,
                    normalized_key=cls.normalized_key(settlement, street, house),
                    settlement=settlement,
                    street=street,
                    house_number=house,
                    full_address=full_address,
                    latitude=Decimal(str(point[0])) if point else None,
                    longitude=Decimal(str(point[1])) if point else None,
                    osm_type=str(element.get("type") or ""),
                    osm_id=str(element.get("id") or ""),
                ),
            )
        return records

    @classmethod
    def _dedupe_records(cls, records: Iterable[AddressRecord]) -> list[AddressRecord]:
        by_key: dict[str, AddressRecord] = {}
        for record in records:
            existing = by_key.get(record.normalized_key)
            if not existing:
                by_key[record.normalized_key] = record
                continue
            if existing.latitude is None and record.latitude is not None:
                by_key[record.normalized_key] = record
        return list(by_key.values())

    @classmethod
    def normalized_key(cls, settlement: str, street: str, house: str) -> str:
        return cls.normalize(f"{settlement}|{street}|{house}")

    @staticmethod
    def normalize(value: str) -> str:
        return (
            str(value or "")
            .strip()
            .lower()
            .replace("ё", "е")
            .replace("№", "")
            .replace('"', "")
            .replace("'", "")
        )

    @staticmethod
    def full_address(settlement: str, street: str, house: str) -> str:
        parts = ["Салаватский район", settlement, street, f"дом {house}"]
        return ", ".join(part for part in parts if part)

    @staticmethod
    def _element_point(element: dict) -> tuple[float, float] | None:
        if isinstance(element.get("lat"), (int, float)) and isinstance(element.get("lon"), (int, float)):
            return float(element["lat"]), float(element["lon"])
        center = element.get("center") or {}
        if isinstance(center.get("lat"), (int, float)) and isinstance(center.get("lon"), (int, float)):
            return float(center["lat"]), float(center["lon"])
        return None

    @staticmethod
    def _local_name(tag: str) -> str:
        return tag.rsplit("}", 1)[-1].upper()

    @staticmethod
    def _looks_salavat(attrs: dict[str, str]) -> bool:
        haystack = " ".join(attrs.values()).lower()
        if any(marker in haystack for marker in SALAVAT_MARKERS):
            return True
        # Official region archives often put hierarchy in separate files. Keep
        # unscoped records out unless their identifiers explicitly mention area data.
        return bool(re.search(r"\b02\b", haystack) and "салават" in haystack)

