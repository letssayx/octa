from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import groq

app = FastAPI(title="Octa Desktop Engine Control Plane")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev only. Configure strictly in prod.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq client
# Fallback to empty string for initial scaffold if missing
groq_client = groq.Groq(api_key=os.environ.get("GROQ_API_KEY", "placeholder"))

class GenerateCodeRequest(BaseModel):
    intent: str
    metadata_schema: str
    context: str = "" # Grounded Memory Context

class GenerateCodeResponse(BaseModel):
    generated_code: str
    explanation: str

@app.get("/")
def read_root():
    return {"status": "Control Plane Active. Privacy-First boundaries enforced."}

@app.post("/api/v1/generate", response_model=GenerateCodeResponse)
def generate_logic(request: GenerateCodeRequest, authorization: str = Header(None)):
    """
    Core Route for the Orchestrator.
    Receives ONLY metadata schemas and intents. Never raw user row data.
    """
    if not authorization:
        # Placeholder for real OAuth logic
        pass

    system_prompt = f"""
    You are an expert Data Engineer and Python/SQL programmer.
    You must output perfectly valid code based ONLY on the provided schema.
    Grounded Memory Context: {request.context}

    Provided Schema Metadata:
    {request.metadata_schema}
    """

    user_prompt = f"Intent: {request.intent}"

    try:
        if groq_client.api_key == "placeholder":
            # Mock response for testing without API key
            return GenerateCodeResponse(
                generated_code="SELECT * FROM table;",
                explanation="[MOCK] To generate real code, set GROQ_API_KEY."
            )

        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="llama3-8b-8192",
            temperature=0.1,
        )

        response_text = chat_completion.choices[0].message.content

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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
