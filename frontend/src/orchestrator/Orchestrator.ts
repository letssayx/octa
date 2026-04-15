// import { initDuckDB, executeLocalSQL } from '../lib/duckdb';
import { executeLocalPython } from '../lib/pyodide';
import { chatWithGroq } from '../lib/groq';
import { chatWithOpenRouter } from '../lib/openrouter';
import { chatWithHuggingFace } from '../lib/huggingface';

export const TaskType = {
    ACCOUNTING_DATA_CRUNCHING: 'ACCOUNTING_DATA_CRUNCHING',
    DEEP_RESEARCH_PDF: 'DEEP_RESEARCH_PDF',
    IMAGE_MODIFICATION: 'IMAGE_MODIFICATION',
    COMMUNICATION_HR: 'COMMUNICATION_HR',
    LOCAL_CHAT_DRAFTING: 'LOCAL_CHAT_DRAFTING'
} as const;

export type OctaAgent = {
    role: string;
    goal: string;
    backstory: string;
};

const AGENTS: Record<string, OctaAgent> = {
    DATA_SCIENTIST: {
        role: "Senior Data Scientist",
        goal: "Write highly efficient, bug-free Python code using pandas to process, analyze, and transform local datasets.",
        backstory: "You are an elite data scientist who specializes in transforming messy CSV data into actionable insights using pandas. You write pure logic and never rely on external databases or APIs. Your code always returns a list of dictionaries."
    },
    HR_SPECIALIST: {
        role: "HR & Communications Expert",
        goal: "Draft professional, empathetic, and clear communications based on user intent.",
        backstory: "You are a seasoned HR professional who excels at resolving conflicts, writing announcements, and drafting formal emails."
    },
    GENERAL_ASSISTANT: {
        role: "Helpful General Assistant",
        goal: "Assist the user with general queries and drafting.",
        backstory: "You are a helpful, versatile AI assistant designed to provide direct and concise answers."
    }
};

export class TaskOrchestrator {

    public static classifyIntent(prompt: string): string {
        const p = prompt.toLowerCase();

        if (p.includes('calculate') || p.includes('sales') || p.includes('inventory') || p.includes('margin') || p.includes('stock') || p.includes('collate') || p.includes('sku') || p.includes('qty') || p.includes('product')) {
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
            const agent = AGENTS.DATA_SCIENTIST;
            const systemPrompt = `Role: ${agent.role}\nGoal: ${agent.goal}\nBackstory: ${agent.backstory}

            CRITICAL CONSTRAINTS:
            - You are NOT a web application builder. Do NOT write React components, HTML, or full web apps.
            - Your ONLY job is to write perfectly valid, executable Python code to process data.
            - The data has been written to the local virtual filesystem. Read it using pandas: \`pd.read_csv('filename.csv')\`. Use the exact filenames mentioned in the Context/Schema below.
            - You MUST output the result as a LIST OF DICTIONARIES (JSON records).
            - For example:
              \`\`\`python
              import pandas as pd
              df = pd.read_csv('filename.csv')
              # ... your processing ...
              result = df.to_dict(orient='records')
              result # Return value for pyodide
              \`\`\`
            - DO NOT use Google Sheets API, network calls, or external services. Operate ONLY on the local data.

            User Intent: ${prompt}
            Context/Schema: ${context}`;

            let generatedLogic = "";
            const settingsStr = localStorage.getItem('octa_settings');
            let settings = { llmProvider: 'auto', groqApiKey: '', openRouterApiKey: '', hfApiKey: '' };
            if (settingsStr) {
                try {
                    settings = JSON.parse(settingsStr);
                } catch (e) {}
            }

            const groqKey = settings.groqApiKey || import.meta.env.VITE_GROQ_API_KEY;
            const openRouterKey = settings.openRouterApiKey;
            const hfKey = settings.hfApiKey;

            // Intelligent Routing for Accounting Task (Coding/Python Generation)
            // Auto-Router uses open-source coding experts via OpenRouter (DeepSeek)
            if ((settings.llmProvider === 'auto' || settings.llmProvider === 'openrouter') && openRouterKey) {
                console.log("-> Routing to OpenRouter (DeepSeek Coder / Qwen)");
                // Defaulting to deepseek-coder as it's an excellent open-source model for logical tasks
                generatedLogic = (await chatWithOpenRouter(openRouterKey, prompt, systemPrompt, "deepseek/deepseek-coder")) || "";
            } else if ((settings.llmProvider === 'auto' || settings.llmProvider === 'groq') && groqKey && groqKey !== "your_key_here") {
                 console.log("-> Routing to Groq API (Fast Llama3)");
                 generatedLogic = (await chatWithGroq(groqKey, prompt, systemPrompt)) || "";
            } else if ((settings.llmProvider === 'auto' || settings.llmProvider === 'huggingface') && hfKey) {
                 console.log("-> Routing to Hugging Face API");
                 generatedLogic = (await chatWithHuggingFace(hfKey, prompt, systemPrompt)) || "";
            } else {
                 return { status: "error", action: "none", message: "Please set an API key in Settings (Groq, OpenRouter, or Hugging Face)." };
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
            let settings = { llmProvider: 'auto', groqApiKey: '', openRouterApiKey: '', hfApiKey: '' };
            if (settingsStr) {
                try {
                    settings = JSON.parse(settingsStr);
                } catch (e) {}
            }

            const groqKey = settings.groqApiKey || import.meta.env.VITE_GROQ_API_KEY;
            const openRouterKey = settings.openRouterApiKey;
            const hfKey = settings.hfApiKey;

            // Determine agent persona based on simple heuristic (can be expanded)
            let agent = AGENTS.GENERAL_ASSISTANT;
            if (prompt.toLowerCase().includes('hr') || prompt.toLowerCase().includes('email') || prompt.toLowerCase().includes('draft')) {
                agent = AGENTS.HR_SPECIALIST;
            }

            const systemPrompt = `Role: ${agent.role}\nGoal: ${agent.goal}\nBackstory: ${agent.backstory}\n\nContext rules: ${context}\n\nIf the user asks about the data schema or contents of the file, you MUST use the Context rules provided to answer them accurately. Do NOT invent data or give generic answers.`;

            // General chat favors speed (Groq) or standard models
            if ((settings.llmProvider === 'auto' || settings.llmProvider === 'groq') && groqKey && groqKey !== "your_key_here") {
                console.log("-> Routing to Groq API (Fast Chat)");
                const response = await chatWithGroq(groqKey, prompt, systemPrompt);
                return { status: "success", action: "local_chat", message: response };
            } else if ((settings.llmProvider === 'auto' || settings.llmProvider === 'openrouter') && openRouterKey) {
                console.log("-> Routing to OpenRouter");
                const response = await chatWithOpenRouter(openRouterKey, prompt, systemPrompt, "meta-llama/llama-3.1-8b-instruct");
                return { status: "success", action: "local_chat", message: response };
            } else if ((settings.llmProvider === 'auto' || settings.llmProvider === 'huggingface') && hfKey) {
                console.log("-> Routing to Hugging Face API");
                const response = await chatWithHuggingFace(hfKey, prompt, systemPrompt);
                return { status: "success", action: "local_chat", message: response };
            } else {
                return { status: "error", action: "none", message: "Please set an API key in Settings (Groq, OpenRouter, or Hugging Face)." };
            }
        } catch (e: any) {
             console.error("AI Chat Error:", e);
             return { status: "error", action: "none", message: `AI Chat Error: ${e.message}` };
        }
    }
}
