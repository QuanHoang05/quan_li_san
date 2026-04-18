import asyncio
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_routes():
    # Test products
    try:
        response = client.get("/api/v1/products")
        print("GET /api/v1/products:", response.status_code, response.text[:200])
    except Exception as e:
        print("GET products error:", e)

    # Test inventory logs
    try:
        response = client.get("/api/v1/inventory/logs")
        print("GET /api/v1/inventory/logs:", response.status_code, response.text[:200])
    except Exception as e:
        print("GET inventory logs error:", e)

if __name__ == "__main__":
    test_routes()
