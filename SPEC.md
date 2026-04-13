# Object Definitions & Framework

This specification details the components comprising the Privacy-First "Octa Desktop" Engine. The system relies on a hybrid execution strategy to ensure robust capabilities while strictly enforcing client-side data privacy.

## Object Details

| Component | Object / Technology | Privacy Role & Functionality |
| :--- | :--- | :--- |
| **Logic & Drafting Engine** | WebLLM (In-Browser SLM) | Generates SQL, drafts emails, and handles chat entirely locally via WebGPU. Model weights are cached in the browser's IndexedDB. No server-side API calls are required. |
| **Computation Engine** | DuckDB-WASM | Performs data collating (Excel/CSV), accounting, sales analysis, and local data querying natively within the client's browser memory. |
| **Data Grid & UI** | FortuneSheet / Specialized UI | Provides an exact embedded Excel/Spreadsheet clone experience for accounting/inventory natively in the browser via `<Workbook />`. Plus specific views for ad-hoc outputs. |
| **Public Data Connector** | Browser `fetch` (Fetch API) | Fetches real-time internet data (e.g., public stock APIs) on demand when requested by the AI, directly from the client. |
| **Automation Hub (Local)** | URL Schemes & Native Browser APIs | Utilizes `wa.me` for WhatsApp and `mailto:` for emails. Uses `setInterval` and `Notification.requestPermission()` for offline Reminders. Avoids centralized automation servers like Twilio. |
| **Context-Bounded Workspace** | OPFS (Origin Private File System) | The core of the "Desktop" feel. Provides hierarchical Folders that isolate Chat History and AI Context, preventing context-overwhelm. Safely and persistently saves generated outputs and raw data to the user's hard drive sandbox. |

## Execution Framework

### 100% Local Inference Paradigm
1.  **Task Routing & Intent:** The user provides a prompt (e.g., "Collate these HR excels," "Analyze my stock"). The local orchestrator classifies the intent.
2.  **Data Ingestion:** Files (CSVs) are uploaded and loaded locally into **DuckDB-WASM**. No files are uploaded to any server.
3.  **Real-Time Data Fetching:** If the task requires current internet data (e.g., "Analyze stock X"), the frontend executes a `fetch` request to grab the latest public information to provide context to the AI.
4.  **Local Execution & SQL Generation:** The WebLLM instance (running via WebGPU) formulates queries based on the file's schema or the real-time data fetched, and passes it to DuckDB-WASM.
5.  **Results & Persistence:** The final outputs (a combined Excel file, an Accounting grid) are displayed in the UI and can be saved locally to the OPFS. Local hooks (`mailto:`, `wa.me`) are triggered if communication is requested.

### Implicit Grounded Memory & Context Bounding
To provide a magical, zero-configuration "Desktop" experience:
- **Context Bounding:** Users create "Folders" (e.g., "Amazon Product Assets"). Each folder maintains its own isolated chat history. The AI *never* reads history outside the active folder, eliminating the "infinite scroll context wipe" common in typical chatbots.
- **`MEM_SAVE` (Implicit):** The Orchestrator observes the user's actions. If a user corrects a formatting script to use "1024x1024", the Orchestrator silently writes this rule into a hidden `.octa_context` file *inside that specific folder*. No manual "Save Settings" buttons are exposed.
- **`MEM_LOAD`:** Before any prompt is sent to the SLM, the frontend reads the `.octa_context` of the *active folder* and prepends it to the system instructions.
