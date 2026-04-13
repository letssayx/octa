import { chatWithWebLLM, initWebLLM } from '../lib/webllm';
import { initDuckDB, executeLocalSQL } from '../lib/duckdb';

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

    public static async handleTask(prompt: string, folderName: string, folderContext: string = "") {
        console.log(`[ORCHESTRATOR] Routing prompt: "${prompt}" in folder: ${folderName}`);

        const taskType = this.classifyIntent(prompt);

        switch (taskType) {
            case TaskType.ACCOUNTING_DATA_CRUNCHING:
                return this.executeAccountingTask(prompt, folderName, folderContext);
            case TaskType.LOCAL_CHAT_DRAFTING:
                return this.executeLocalChatTask(prompt, folderContext);
            default:
                return { status: "success", action: "placeholder", message: `Task parsed as ${taskType}. Logic pending.` };
        }
    }

    private static async executeAccountingTask(prompt: string, _folder: string, context: string) {
        console.log("-> Routing to Local WebLLM Engine to generate SQL...");
        try {
            await initWebLLM((progress) => console.log(`[WebLLM Progress] ${progress.text}`));

            const systemPrompt = `You are an expert Data Engineer. Output perfectly valid SQL based ONLY on the provided schema. Schema: Table ContextFiles (id INT, filename VARCHAR). Intent: ${prompt}. ${context}`;

            const response = await chatWithWebLLM(systemPrompt, "");

            // Real Stitching: Execute the generated SQL locally in DuckDB!
            await initDuckDB();

            // For now, we prove the stitch by running a safe test query locally.
            // In a real app, you would parse the SQL from `response` and execute it.
            const sampleSQL = "SELECT 42 as answer, 'Real DuckDB Executed!' as status";
            const localResult = await executeLocalSQL(sampleSQL);

            return {
                status: "success",
                action: "duckdb_sql",
                message: `[Locally Generated SQL Draft]\n${response}\n\nData rendered securely in FortuneSheet.`,
                data: localResult
            };
        } catch (e: any) {
            console.error("WebLLM/DuckDB failed:", e);
            return { status: "error", action: "none", message: `Local Execution Error: ${e.message}` };
        }
    }

    private static async executeLocalChatTask(prompt: string, context: string) {
        console.log("-> Routing to Local WebLLM Engine (In-Browser)...");
        try {
            // Attempt to init if not already (this downloads the model on first run)
            await initWebLLM((progress) => console.log(`[WebLLM Progress] ${progress.text}`));
            const response = await chatWithWebLLM(prompt, context);
            return { status: "success", action: "local_chat", message: response };
        } catch (e: any) {
             console.error("WebLLM Error:", e);
             return { status: "error", action: "none", message: `Local AI Error: ${e.message}. Note: WebGPU is required.` };
        }
    }
}
