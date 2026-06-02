# Kinetix Logistics Services

FastAPI microservice for advanced taxi logistics:

- surge pricing before order creation;
- Redis GEO driver index;
- greedy and batch dispatch;
- trip settlement with driver autocompensation;
- Salavat district GAR/FIAS + OSM address import;
- Redis Streams consumer for `pending_orders`.

## Run Locally

```bash
cd logistics-services
python -m venv .venv
.venv\Scripts\activate
pip install -e .[test]
uvicorn app.main:app --reload --port 3200
```

Run workers:

```bash
celery -A app.workers.celery_app.celery_app worker --loglevel=info
celery -A app.workers.celery_app.celery_app beat --loglevel=info
python -m app.workers.stream_consumer
```

Node remains the source of order state. Python receives new orders via Redis Stream
`pending_orders`, then calls Node REST callbacks such as `/orders/{id}/assign`,
`/orders/{id}/status`, and `/orders/{id}/payment`.

