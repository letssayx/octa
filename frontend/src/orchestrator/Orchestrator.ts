import { chatWithWebLLM, initWebLLM } from '../lib/webllm';
// import { initDuckDB, executeLocalSQL } from '../lib/duckdb';
import { executeLocalPython } from '../lib/pyodide';
import { chatWithGroq } from '../lib/groq';

export const TaskType = {
    ACCOUNTING_DATA_CRUNCHING: 'ACCOUNTING_DATA_CRUNCHING',
    DEEP_RESEARCH_PDF: 'DEEP_RESEARCH_PDF',
    IMAGE_MODIFICATION: 'IMAGE_MODIFICATION',
    COMMUNICATION_HR: 'COMMUNICATION_HR',
    LOCAL_CHAT_DRAFTING: 'LOCAL_CHAT_DRAFTING'
} as const;

export class TaskOrchestrator {

    public static classifyIntent(prompt: string): string {
        const p = prompt.toLowerCase();

        if (p.includes('calculate') || p.includes('sales') || p.includes('inventory') || p.includes('margin') || p.includes('stock') || p.includes('collate')) {
            return TaskType.ACCOUNTING_DATA_CRUNCHING;
        }
        if (p.includes('pdf') || p.includes('report')) {
            return TaskType.DEEP_RESEARCH_PDF;
        }
        if (p.includes('image') || p.includes('format') || p.includes('shopify') || p.includes('myntra')) {
            return TaskType.IMAGE_MODIFICATION;
        }

        // Default to local drafting for generic chat or HR/Emails
        return TaskType.LOCAL_CHAT_DRAFTING;
    }

    public static async handleTask(prompt: string, folderName: string, folderContext: string = "", isVerification: boolean = false) {
        console.log(`[ORCHESTRATOR] Routing prompt: "${prompt}" in folder: ${folderName}`);

        const taskType = this.classifyIntent(prompt);

        switch (taskType) {
            case TaskType.ACCOUNTING_DATA_CRUNCHING:
                return this.executeAccountingTask(prompt, folderName, folderContext, isVerification);
            case TaskType.LOCAL_CHAT_DRAFTING:
                return this.executeLocalChatTask(prompt, folderContext);
            default:
                return { status: "success", action: "placeholder", message: `Task parsed as ${taskType}. Logic pending.` };
        }
    }

    private static async executeAccountingTask(prompt: string, _folder: string, context: string, isVerification: boolean) {
        console.log("-> Routing Accounting Task (Python/SQL Generation)...");
        try {
            const systemPrompt = `You are an expert Data Engineer and Python Engine.
            CRITICAL CONSTRAINT: You are NOT a web application builder. Do NOT write React components, HTML, or full web apps.
            Your ONLY job is to write perfectly valid, executable Python code to process data based on the user's intent.

            IMPORTANT PYODIDE CONSTRAINTS:
            - The data has been written to the virtual filesystem. Read it using pandas: \`pd.read_csv('filename.csv')\`.
            - You MUST output the result as a LIST OF DICTIONARIES (JSON records) printed to stdout, or return it directly so the Pyodide runtime can capture it.
            - For example:
              \`\`\`python
              import pandas as pd
              import json
              df = pd.read_csv('filename.csv')
              # ... your processing ...
              result = df.to_dict(orient='records')
              result # Return value for pyodide
              \`\`\`
            - DO NOT attempt to use Google Sheets API, network calls, or external services. Operate ONLY on the provided local data files.

            Intent: ${prompt}.
            Context/Schema rules: ${context}`;

            let generatedLogic = "";
            const settingsStr = localStorage.getItem('octa_settings');
            let settings = { llmProvider: 'webllm', groqApiKey: '' };
            if (settingsStr) {
                try {
                    settings = JSON.parse(settingsStr);
                } catch (e) {}
            }

            const groqKey = settings.groqApiKey || import.meta.env.VITE_GROQ_API_KEY;

            if ((settings.llmProvider === 'groq' || !settings.llmProvider) && groqKey && groqKey !== "your_key_here") {
                 console.log("-> Using Groq API (Power User Mode)");
                 generatedLogic = (await chatWithGroq(groqKey, prompt, systemPrompt)) || "";
            } else {
                 console.log("-> Routing to Local WebLLM Engine (Default Mode)");
                 await initWebLLM((progress) => console.log(`[WebLLM Progress] ${progress.text}`));
                 generatedLogic = (await chatWithWebLLM(systemPrompt, "")) || "";
            }

            console.log("-> Executing generated logic locally...");

            // Extract Python code block from the LLM response
            let pythonCode = "";
            const match = generatedLogic.match(/```python\n([\s\S]*?)```/);
            if (match && match[1]) {
                pythonCode = match[1];
            } else {
                // Fallback, attempt to run the whole thing if no codeblocks found
                pythonCode = generatedLogic;
            }

            let dataResult: any = null;
            let executionMessage = "";
            try {
                const pyResult = await executeLocalPython(pythonCode);

                // If Pyodide returns a Proxy object (like a JS Map/Array representation of Python dict/list)
                if (pyResult && typeof pyResult.toJs === 'function') {
                    dataResult = pyResult.toJs();
                } else if (typeof pyResult === 'string') {
                    try {
                         dataResult = JSON.parse(pyResult);
                    } catch(e) {
                         dataResult = [{ "Result": pyResult }];
                    }
                } else {
                    dataResult = pyResult;
                }

                // Fallback if dataResult is not an array of objects
                if (!Array.isArray(dataResult)) {
                    dataResult = [{ "Result": String(pyResult) }];
                }

                executionMessage = `Computed locally via Pyodide. ${isVerification ? "Verification Applied." : ""}`;
            } catch (pyError: any) {
                 console.error("Pyodide execution failed:", pyError);
                 dataResult = [{ "Status": "Error", "Message": pyError.message }];
                 executionMessage = `[Execution Error]\n${pyError.message}`;
            }

            return {
                status: "success",
                action: "python_compute",
                message: `[Generated Logic]\n${generatedLogic}\n\n${executionMessage}`,
                data: dataResult,
                generatedLogic: generatedLogic || ""
            };
        } catch (e: any) {
            console.error("Execution failed:", e);
            return { status: "error", action: "none", message: `Execution Error: ${e.message}` };
        }
    }

    private static async executeLocalChatTask(prompt: string, context: string) {
        console.log("-> Routing Chat Task...");
        try {
            const settingsStr = localStorage.getItem('octa_settings');
            let settings = { llmProvider: 'webllm', groqApiKey: '' };
            if (settingsStr) {
                try {
                    settings = JSON.parse(settingsStr);
                } catch (e) {}
            }

            const groqKey = settings.groqApiKey || import.meta.env.VITE_GROQ_API_KEY;

            if (settings.llmProvider === 'groq' && groqKey && groqKey !== "your_key_here") {
                console.log("-> Using Groq API for Chat");
                const systemPrompt = `You are a helpful AI assistant. Context rules: ${context}`;
                const response = await chatWithGroq(groqKey, prompt, systemPrompt);
                return { status: "success", action: "local_chat", message: response };
            } else {
                console.log("-> Routing to Local WebLLM Engine (In-Browser)...");
                // Attempt to init if not already (this downloads the model on first run)
                await initWebLLM((progress) => console.log(`[WebLLM Progress] ${progress.text}`));
                const response = await chatWithWebLLM(prompt, context);
                return { status: "success", action: "local_chat", message: response };
            }
        } catch (e: any) {
             console.error("AI Chat Error:", e);
             return { status: "error", action: "none", message: `AI Chat Error: ${e.message}` };
        }
    }
}
