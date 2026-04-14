# Object Definitions & Framework

This specification details the components comprising the Privacy-First "Octa Desktop" Engine. The system relies on a hybrid execution strategy to ensure robust capabilities while strictly enforcing client-side data privacy.

## Object Details

| Component | Object / Technology | Privacy Role & Functionality |
| :--- | :--- | :--- |
| **Logic & Drafting Engine** | WebLLM (Default) / Groq API (Opt-in) | Generates Python/SQL logic. Defaults to a local Gemma SLM via WebGPU. Power users can input a Groq key for faster inference. Strictly constrained to data processing, rejecting full app development requests. |
| **Computation Engine** | Pyodide / DuckDB-WASM | Pyodide executes AI-generated Python code directly in the browser. DuckDB handles structured CSVs. All data remains in client RAM. |
| **Data Grid & UI** | FortuneSheet / Specialized UI | Provides an exact embedded Excel/Spreadsheet clone experience for accounting/inventory natively in the browser via `<Workbook />`. Plus specific views for ad-hoc outputs. |
| **Public Data Connector** | Browser `fetch` (Fetch API) | Fetches real-time internet data (e.g., public stock APIs) on demand when requested by the AI, directly from the client. |
| **Automation Hub (Local)** | URL Schemes & Native Browser APIs | Utilizes `wa.me` for WhatsApp and `mailto:` for emails. Uses `setInterval` and `Notification.requestPermission()` for offline Reminders. Avoids centralized automation servers like Twilio. |
| **Context-Bounded Workspace** | OPFS (Origin Private File System) | The core of the "Desktop" feel. Provides hierarchical Folders that isolate Chat History and AI Context, preventing context-overwhelm. Safely and persistently saves generated outputs and raw data to the user's hard drive sandbox. |

## Execution Framework

### The 4-Step Verification Loop
1.  **Data / Query Ingestion:** User provides data files and a prompt (e.g., "Calculate margins").
2.  **Computation via Python:** The orchestrator routes the prompt to Groq (if key exists) or local WebLLM. The AI writes Python code which is then executed locally by `Pyodide` to manipulate the data.
3.  **Verification:** The user reviews the output. If incorrect, they provide feedback (e.g., "Exclude row 5"). The AI adjusts the code and re-computes in Pyodide. This loop continues until satisfaction.
4.  **Output & Locking:** Once correct, the user locks the logic. The specific data transformations/rules are saved as verification logic in the folder's `.octa_context` file, ensuring future runs apply the exact same rules without requiring re-prompting.

### Implicit Grounded Memory & Context Bounding
To provide a magical, zero-configuration "Desktop" experience:
- **Context Bounding:** Users create "Folders" (e.g., "Amazon Product Assets"). Each folder maintains its own isolated chat history. The AI *never* reads history outside the active folder, eliminating the "infinite scroll context wipe" common in typical chatbots.
- **`MEM_SAVE` (Implicit):** The Orchestrator observes the user's actions. If a user corrects a formatting script to use "1024x1024", the Orchestrator silently writes this rule into a hidden `.octa_context` file *inside that specific folder*. No manual "Save Settings" buttons are exposed.
- **`MEM_LOAD`:** Before any prompt is sent to the SLM, the frontend reads the `.octa_context` of the *active folder* and prepends it to the system instructions.
