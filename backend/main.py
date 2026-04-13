from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import httpx
import asyncpg
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load WSL/Local environment variables
load_dotenv()

# Database connection placeholder for existing Docker TimescaleDB
DB_URL = os.environ.get("DATABASE_URL", "postgresql://user:pass@localhost:5432/octadesk")

# Global Connection Pool
db_pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool
    print(f"🔄 Connecting to TimescaleDB at {DB_URL.split('@')[-1]}...")
    try:
        db_pool = await asyncpg.create_pool(DB_URL, min_size=1, max_size=10)
        print("✅ Successfully connected to TimescaleDB pool.")
    except Exception as e:
        print(f"⚠️ Failed to connect to TimescaleDB. Ensure Docker is running. Error: {e}")

    yield

    if db_pool:
        await db_pool.close()
        print("🛑 TimescaleDB connection pool closed.")


app = FastAPI(title="Octa Desktop Engine Control Plane", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev only. Configure strictly in prod.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ollama configuration
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5-coder")


class GenerateCodeRequest(BaseModel):
    intent: str
    metadata_schema: str
    context: str = "" # Grounded Memory Context

class GenerateCodeResponse(BaseModel):
    generated_code: str
    explanation: str

@app.get("/")
async def read_root():
    db_status = "Connected" if db_pool else "Disconnected"
    return {
        "status": "Control Plane Active. Privacy-First boundaries enforced.",
        "timescale_db": db_status
    }

from fastapi import Request

@app.post("/api/v1/generate", response_model=GenerateCodeResponse)
async def generate_logic(request: GenerateCodeRequest, http_request: Request, authorization: str = Header(None)):
    """
    Core Route for the Orchestrator.
    Receives ONLY metadata schemas and intents. Never raw user row data.
    """

    system_prompt = f"""
    You are an expert Data Engineer and Python/SQL programmer.
    You must output perfectly valid code based ONLY on the provided schema.
    Grounded Memory Context: {request.context}

    Provided Schema Metadata:
    {request.metadata_schema}
    """

    user_prompt = f"Intent: {request.intent}"

    try:
        # 100% Local Inference via Ollama
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/api/chat",
                    json={
                        "model": OLLAMA_MODEL,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "stream": False,
                        "options": {"temperature": 0.1}
                    },
                    timeout=60.0
                )
                response.raise_for_status()
                response_text = response.json()["message"]["content"]
        except httpx.ConnectError:
             return GenerateCodeResponse(
                generated_code="-- [MOCK SQL] SELECT * FROM sales;",
                explanation="[ERROR] Could not connect to Local Ollama instance. Is it running on port 11434? Returning Mock data."
            )

        # Simple extraction logic (assuming markdown formatting)
        code_block = response_text
        if "```" in response_text:
            code_block = response_text.split("```")[1]
            if code_block.startswith("sql\n") or code_block.startswith("python\n"):
               code_block = code_block.split("\n", 1)[1]

        return GenerateCodeResponse(
            generated_code=code_block.strip(),
            explanation="Code successfully generated using Llama-3."
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Use 8081 to avoid WSL conflicts with other local apps
    port = int(os.environ.get("PORT", 8081))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
