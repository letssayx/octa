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

**Task Orchestration & AI (WebLLM & Groq Fallback):**
The system routes logic generation based on user preference:
- *Local Default (Gemma via WebLLM):* Standard users run AI models directly in the browser using WebGPU. Model weights are cached in IndexedDB.
- *Power User (Groq API):* Users can supply a Groq API key to offload heavy logic generation to Groq for maximum speed.
- *Strict Scope:* System prompts enforce that the AI acts **only as a data processing engine**, not a full web app builder (like bolt.new). It generates Python/SQL scripts for business logic, not React components.

**Computation & Verification Loop (Pyodide & DuckDB):**
Raw data (like sales figures or CRM files) uploaded by the user is loaded directly into local memory.
1. *Ingestion:* User provides a task.
2. *Computation:* The AI generates Python code (executed via `Pyodide` in the browser) or SQL (executed via `DuckDB-WASM`).
3. *Verification & Output:* The results are displayed (e.g., in FortuneSheet). If the user notes an error (e.g., "Exclude tax"), the AI regenerates the logic.
4. *Locking Logic:* Once correct, the user can "lock" the verification logic, permanently saving the rule into the folder's implicit memory (`.octa_context`) for future files.

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
