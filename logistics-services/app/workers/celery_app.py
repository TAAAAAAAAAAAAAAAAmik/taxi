from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "kinetix_logistics",
    broker=settings.celery_broker,
    backend=settings.celery_backend,
    include=["app.workers.tasks"],
)
celery_app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    timezone="Asia/Yekaterinburg",
)
celery_app.conf.beat_schedule = {
    "import-salavat-addresses-nightly": {
        "task": "app.workers.tasks.import_salavat_addresses",
        "schedule": 60 * 60 * 24,
        "args": (),
    },
    "check-expiring-subscriptions-daily": {
        "task": "app.workers.tasks.check_expiring_subscriptions",
        "schedule": 60 * 60 * 24,
        "args": (),
    },
    "check-marketing-thresholds-hourly": {
        "task": "app.workers.tasks.check_marketing_thresholds",
        "schedule": 60 * 60,
        "args": (),
    },
    "accrue-marketing-location-bonuses-daily": {
        "task": "app.workers.tasks.accrue_monthly_marketing_location_bonuses",
        "schedule": 60 * 60 * 24,
        "args": (),
    },
}
