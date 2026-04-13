# Object Definitions & Framework

This specification details the components comprising the Privacy-First "Octa Desktop" Engine. The system relies on a hybrid execution strategy to ensure robust capabilities while strictly enforcing client-side data privacy.

## Object Details

| Component | Object / Technology | Privacy Role & Functionality |
| :--- | :--- | :--- |
| **Task Orchestrator & SLMs** | WebLLM (Specialized "Local MoE") | A "Traffic Cop" frontend that routes tasks to task-specific Small Language Models (e.g., Drafting, Summarization) or engines. Handles Deep Research, Report drafting, and local logic directly in the browser. |
| **Complex Logic Generator** | Local Ollama (Qwen2.5-Coder via FastAPI) | 100% Local inference. High-power models running directly on the user's machine (or a secure self-hosted VM). Generates advanced SQL/Python for Data Crunching. No third-party APIs used. |
| **Computation Engine** | DuckDB-WASM / Pyodide / Canvas | Performs data collating (Excel/CSV), accounting, sales analysis, HR payroll tracking, and Image processing directly in client RAM. Executes logic natively or via Groq-generated code. |
| **Data Grid & UI** | FortuneSheet / Specialized UI | Provides an exact embedded Excel/Spreadsheet clone experience for accounting/inventory natively in the browser via `<Workbook />`. Plus specific views for Research PDFs and Image formatting. |
| **Public Data & Automation Connector** | FastAPI, TimescaleDB, Playwright | Secure gateway streaming public market ticks from Timescale. Additionally, uses Playwright for Backend Browser Automation to process orders on cross-origin websites (e.g., Shopify) that the frontend cannot reach due to CORS. |
| **Automation Hub (Local)** | URL Schemes & Native Browser APIs | Utilizes `wa.me` for WhatsApp and `mailto:` for emails. Uses `setInterval` and `Notification.requestPermission()` for offline Reminders. Avoids centralized automation servers like Twilio or n8n. |
| **Ad-Hoc Tooling** | Markdown Editor & IndexedDB | Provides a local scribble notepad that automatically saves notes directly to the active OPFS folder. |
| **Context-Bounded Workspace** | OPFS (Origin Private File System) | The core of the "Desktop" feel. Provides hierarchical Folders that isolate Chat History and AI Context, preventing context-overwhelm. Safely and persistently saves generated PDFs, images, and raw data to the user's hard drive sandbox. |

## Execution Framework

### The "OpenClaw" Paradigm
By adopting this model, the SaaS platform provides the high-performance "Claw" (the algorithms, UI frameworks, code-generation services, and public datasets) while the client provides the "Subject" (the raw, sensitive data).

1.  **Task Routing (The Orchestrator):** The user provides a prompt (e.g., "Collate these HR excels," "Format this image for Shopify," or "Analyze my stock"). The local orchestrator classifies the intent and routes it.
2.  **Data Ingestion:** Files (CSVs, PDFs, Images) are loaded locally into the **OPFS** to prevent data loss. Data is mounted into DuckDB-WASM, Pyodide, or Canvas/WebGL.
3.  **Metadata Extraction & Generation:** If the task requires complex code (e.g., Accounting SQL), the frontend extracts *only the schema* and routes it to the local Ollama backend instance. If it requires drafting (e.g., an RFQ or PDF Research), it routes to a local WebLLM SLM.
4.  **Local Execution:** The generated logic is executed against the local, sensitive data entirely within the browser.
5.  **Results & Persistence:** The final outputs (a combined Excel file, a new Image, an Accounting grid) are displayed in the UI and automatically saved back to the OPFS. Local hooks (`mailto:`, `wa.me`) are triggered if communication is requested.

### Implicit Grounded Memory & Context Bounding
To provide a magical, zero-configuration "Desktop" experience:
- **Context Bounding:** Users create "Folders" (e.g., "Amazon Product Assets"). Each folder maintains its own isolated chat history. The AI *never* reads history outside the active folder, eliminating the "infinite scroll context wipe" common in typical chatbots.
- **`MEM_SAVE` (Implicit):** The Orchestrator observes the user's actions. If a user corrects a formatting script to use "1024x1024", the Orchestrator silently writes this rule into a hidden `.octa_context` file *inside that specific folder*. No manual "Save Settings" buttons are exposed.
- **`MEM_LOAD`:** Before any prompt is sent to an SLM or the Backend, the frontend reads the `.octa_context` of the *active folder* and prepends it to the system instructions.

### Opt-In Telemetry & RLHF
To continuously improve code generation without compromising user data:
- **Telemetry Loop:** If a generated query throws an error locally and the user manually corrects it, they can opt-in to share this correction.
- **Data Logged:** Only the `[Original Prompt]` and `[Corrected Code/Schema]` are sent to the backend Telemetry DB.
- **Reward:** Opt-in users receive application credits. This data will be used to fine-tune future self-hosted models.
