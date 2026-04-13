from fastapi.testclient import TestClient
from main import app
import os

os.environ["GROQ_API_KEY"] = "placeholder"

client = TestClient(app)

def test_read_main():
    with TestClient(app) as client:
        response = client.get("/")
        assert response.status_code == 200

def test_generate_mock():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/generate",
            json={
                "intent": "Show me sales",
                "metadata_schema": "table sales",
                "context": ""
            }
        )
        assert response.status_code == 200
        assert "generated_code" in response.json()
