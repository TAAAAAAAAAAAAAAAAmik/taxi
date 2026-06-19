from functools import lru_cache
from socket import gethostname

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the logistics services."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="KINETIX_LOGISTICS_",
        extra="ignore",
    )

    service_name: str = "kinetix-logistics"
    environment: str = "development"
    api_prefix: str = "/v1"

    redis_url: str = "redis://localhost:6379/0"
    database_url: str = "postgresql+asyncpg://taxi:change-me@localhost:5432/taxi_partner"

    node_api_base_url: str = "http://localhost:3100"
    node_internal_token: str = ""
    node_timeout_seconds: float = 5.0

    dispatch_stream: str = "pending_orders"
    dispatch_consumer_group: str = "logistics_dispatchers"
    dispatch_consumer_name: str = Field(default_factory=lambda: f"{gethostname()}-logistics")
    dispatch_mode: str = "greedy"
    driver_offer_timeout_seconds: int = 15
    batch_window_seconds: int = 5
    default_search_radius_meters: int = 1_000

    surge_pin_ttl_seconds: int = 120
    surge_radius_meters: int = 1_000

    celery_broker_url: str | None = None
    celery_result_backend: str | None = None

    gar_region_code: str = "02"
    gar_archive_path: str = ""
    fias_download_info_url: str = "https://fias.nalog.ru/Frontend/GetAllDownloadFileInfo"
    salavat_area_id: int = 3_600_398_510
    overpass_endpoints: list[str] = [
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass-api.de/api/interpreter",
        "https://overpass.openstreetmap.ru/api/interpreter",
    ]
    address_geo_key: str = "addresses:geo:salavat"

    @property
    def celery_broker(self) -> str:
        """Return the Celery broker URL, defaulting to Redis."""

        return self.celery_broker_url or self.redis_url

    @property
    def celery_backend(self) -> str:
        """Return the Celery result backend URL, defaulting to Redis."""

        return self.celery_result_backend or self.redis_url

    @property
    def node_base_url(self) -> str:
        """Return the Node backend URL without a trailing slash."""

        return self.node_api_base_url.rstrip("/")


@lru_cache
def get_settings() -> Settings:
    """Cache settings for web routes and workers."""

    return Settings()

