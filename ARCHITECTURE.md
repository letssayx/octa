# Privacy-First "Work Done" Engine

This document outlines the architecture for a hybrid, privacy-first Software-as-a-Service (SaaS). The system guarantees data sovereignty by processing sensitive user data entirely within the browser, while leveraging a powerful cloud backend strictly for generating logic (code) and supplying public data.

## 1. System Philosophy

The architecture adheres to an "OpenClaw" inspired model:
- **The Claw (Code & Compute):** The SaaS platform provides high-performance logic, code generation, and UI frameworks.
- **The Subject (Data):** The user provides the data (CSV, Excel, Hisaab-Kitab/CRM), which remains exclusively in their local browser sandbox.

## 2. Architecture Diagram

The Mermaid diagram below visualizes the strict boundaries between the user's local environment and the hosted cloud environment.

```mermaid
graph TD
    subgraph "User Browser (Client Side - Data Sovereign Sandbox)"
        UI[Frontend UI: FortuneSheet / Dify UI Elements]
        W_AI[WebLLM: Local Small Models e.g. Gemma/Llama-3-8b]
        W_DB[DuckDB-WASM: Local Data Engine]
        Py[Pyodide: Local Python Execution]
        LocalData[(User Data: CSV/Excel/CRM)]
        LocalStorage[(IndexedDB: MEM_SAVE & Hisaab Data)]
        LocalComm[Local Communications: mailto: / wa.me]

        %% Internal Client Connections
        UI <--> W_AI
        UI <--> W_DB
        UI <--> Py

        W_AI -- Generates Simple Drafts / Local Logic --> UI
        W_DB <--> LocalData
        Py <--> LocalData
        W_DB <--> LocalStorage
    end

    subgraph "Hosted SaaS (Your Cloud - Control Plane)"
        API[FastAPI Gateway]
        Ollama[Ollama Server: Qwen2.5-Coder]
        S_DB[(TimescaleDB: Public Market Data)]
        Auth[User Auth & Subscription]

        %% Internal Cloud Connections
        API <--> Ollama
        API <--> S_DB
        API <--> Auth
    end

    %% Cross-Boundary Flow (The Privacy Guarantee)
    API -- Streams Public Ticks / Templates --> UI
    UI -- Sends Schema/Metadata ONLY --> API
    API -- Returns Generated SQL/Python Code --> UI

    %% Local Execution Post-Generation
    UI -- Applies Generated SQL --> W_DB
    UI -- Applies Generated Python --> Py
    UI -- Triggers App Hooks --> LocalComm
```

## 3. Boundary Explanations

### The Client Side (Sovereign Zone)
Everything in this zone runs in the client's memory or browser storage. Raw data (like sales figures or client names) is loaded directly into `DuckDB-WASM` or `Pyodide` from local files. The browser UI utilizes embedded spreadsheets (`FortuneSheet`) to view this data. When the user asks a complex question about their data, the frontend only extracts the *schema* (column names and types) or metadata to send to the backend. Local communications and simple chat interactions can be augmented by in-browser models via `WebLLM`.

### The Cloud Side (Control Plane)
The cloud handles heavy lifting that does *not* require user data. It uses `Ollama` hosting `Qwen2.5-Coder` to take the user's plain-text questions and the metadata schema, and translates them into executable SQL or Python. It also exposes public datasets via `TimescaleDB` (e.g., public stock market ticks) which are streamed down to the client. The client can then join this public cloud data with their private local data inside `DuckDB-WASM`.

### No External API Reliance
To maintain total privacy and avoid reliance on third-party opaque services:
- No OpenAI API keys are used; inference is entirely local or via the self-hosted Ollama backend.
- Emails and WhatsApp messages are executed locally by generating URLs (`wa.me` links, `mailto:` protocols), avoiding the need to send contacts to a central automation server.
