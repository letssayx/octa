# Privacy-First "Octa Desktop" Engine

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
        UI[Frontend UI: 3-Pane Desktop Workspace]
        Orchestrator[Local Task Orchestrator]
        W_AI[WebLLM: Specialized SLMs 'Mixture of Experts']
        W_DB[DuckDB-WASM: Local Data Engine]
        Py[Pyodide: Local Python Execution]
        Fortune[FortuneSheet: Excel Clone UI]
        AdHoc[Notepad & Reminders: IndexedDB]
        OPFS[(OPFS: Context-Bounded Folders & Files)]

        %% Internal Client Connections
        UI <--> Orchestrator
        Orchestrator --> W_AI
        Orchestrator --> W_DB
        Orchestrator --> Py

        W_AI -- Task Executed (Drafts/Images) --> UI
        W_DB -- Renders Data --> Fortune
        AdHoc <--> OPFS
        W_DB <--> OPFS
        Py <--> OPFS
        Orchestrator <--> OPFS
    end

        Net[Fetch API / Real-time Internet Data]
    end

    %% External Connections (Real-time data fetching)
    W_AI -- Fetches Public Market Info --> Net
    Net -- Returns Data --> W_AI
```

## 3. Boundary Explanations

### 100% Client Side (Sovereign Zone)
Everything in this architecture runs **exclusively** in the client's memory or browser storage. There is no backend, no database to install, and no large binaries (like Ollama) required. The app functions as a pure frontend application.

**Task Orchestration & AI (WebLLM):**
The AI models run directly in the browser using WebGPU via WebLLM. This means the model weights are downloaded once and cached in the browser's IndexedDB.
- *Logic & Drafting:* The in-browser model generates SQL to process files or drafts responses to the user without sending any prompts to a cloud API.
- *Realtime Info:* If the user asks "Analyze X stock," the application uses standard browser `fetch` requests (potentially routed through a CORS proxy if needed) to grab real-time data from public internet APIs directly, feeding it into the AI's context window.

**Data Crunching (DuckDB-WASM):**
Raw data (like sales figures or CRM files) uploaded by the user is loaded directly into `DuckDB-WASM`.
- The AI generates a SQL query based on the user's intent.
- DuckDB executes this query locally in the browser against the user's file.
- The results are displayed natively using an embedded spreadsheet clone (FortuneSheet).

**Local Persistence & Context-Bounding (The OpenClaw Approach):**
To prevent AI from being overwhelmed by infinite chat history and to provide a true "Desktop" feel, data is organized into **Folders** within the **Origin Private File System (OPFS)**.
- **Context Isolation:** When a user selects a folder (e.g., "Q3 Accounting"), the Orchestrator bounds the AI's context strictly to the files and chat history *within that folder*.
- **Implicit Grounded Memory:** Instead of manual settings, the AI observes user corrections and automatically writes hidden `.octa_context` files into the specific folder. Future prompts within that folder automatically inject this implicit memory.
- **Data Loss Prevention:** All work (collated Excels, generated PDFs) is aggressively saved back into these OPFS folders.

### Complete Privacy Guardrails
To maintain total, uncompromised privacy:
- No row-level user data ever leaves the browser sandbox.
- No telemetry, metadata, or prompts are sent to any external server.
- The application functions as a highly capable, offline-first tool (except when explicit realtime data fetching is required), ensuring the user maintains absolute sovereignty over their data.
