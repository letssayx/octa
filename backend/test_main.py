from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_read_main():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "Control Plane Active. Privacy-First boundaries enforced."}

def test_generate_mock():
    response = client.post(
        "/api/v1/generate",
        json={
            "intent": "Show me sales by region",
            "metadata_schema": "CREATE TABLE sales (region VARCHAR, amount FLOAT);"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "generated_code" in data
    assert "explanation" in data
