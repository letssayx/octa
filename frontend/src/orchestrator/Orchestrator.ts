import { loadPreference } from '../lib/memory';

/**
 * The "Traffic Cop"
 * Uses a basic classifier (or an SLM) to route user intent to the correct engine.
 */
// Use const instead of enum to fix erasableSyntaxOnly typescript error
export const TaskType = {
    ACCOUNTING_DATA_CRUNCHING: 'ACCOUNTING_DATA_CRUNCHING',
    DEEP_RESEARCH_PDF: 'DEEP_RESEARCH_PDF',
    IMAGE_MODIFICATION: 'IMAGE_MODIFICATION',
    COMMUNICATION_HR: 'COMMUNICATION_HR',
    UNKNOWN: 'UNKNOWN'
} as const;

export class TaskOrchestrator {

    // Simple heuristic-based router for V1. Will be replaced by an SLM router.
    public static classifyIntent(prompt: string): string {
        const p = prompt.toLowerCase();

        if (p.includes('calculate') || p.includes('sales') || p.includes('inventory') || p.includes('margin') || p.includes('stock') || p.includes('collate')) {
            return TaskType.ACCOUNTING_DATA_CRUNCHING;
        }
        if (p.includes('research') || p.includes('pdf') || p.includes('report') || p.includes('deep dive')) {
            return TaskType.DEEP_RESEARCH_PDF;
        }
        if (p.includes('image') || p.includes('format') || p.includes('shopify') || p.includes('myntra')) {
            return TaskType.IMAGE_MODIFICATION;
        }
        if (p.includes('email') || p.includes('whatsapp') || p.includes('hr') || p.includes('payroll') || p.includes('rfq')) {
            return TaskType.COMMUNICATION_HR;
        }

        return TaskType.UNKNOWN;
    }

    public static async handleTask(prompt: string, contextData: any = null) {
        console.log(`[ORCHESTRATOR] Received prompt: "${prompt}"`);

        // 1. Load Grounded Memory Preferences
        const defaultMargin = await loadPreference('margin') || '10%';
        console.log(`[MEM_LOAD] Using default margin context: ${defaultMargin}`);

        // 2. Route Task
        const taskType = this.classifyIntent(prompt);
        console.log(`[ORCHESTRATOR] Routing task to: ${taskType}`);

        switch (taskType) {
            case TaskType.ACCOUNTING_DATA_CRUNCHING:
                return this.executeAccountingTask(prompt, contextData);
            case TaskType.DEEP_RESEARCH_PDF:
                return this.executeResearchTask(prompt);
            case TaskType.IMAGE_MODIFICATION:
                return this.executeImageTask(prompt);
            case TaskType.COMMUNICATION_HR:
                return this.executeCommunicationTask(prompt);
            default:
                return "I'm not sure how to handle this task. Please be more specific.";
        }
    }

    private static async executeAccountingTask(_prompt: string, _schema: any) {
        console.log("-> Routing to Groq Backend + DuckDB-WASM...");
        return { status: "success", action: "duckdb_sql", message: "Accounting/Data Collation logic executed." };
    }

    private static async executeResearchTask(_prompt: string) {
        console.log("-> Routing to Local Summarization SLM + PDF Generator...");
        return { status: "success", action: "generate_pdf", message: "PDF Research saved to OPFS." };
    }

    private static async executeImageTask(_prompt: string) {
        console.log("-> Routing to WebGL/Canvas Image Processor...");
        return { status: "success", action: "modify_image", message: "Image formatted for e-commerce." };
    }

    private static async executeCommunicationTask(_prompt: string) {
        console.log("-> Routing to Template Engine + Local Hook...");
        return { status: "success", action: "open_mailto", message: "HR/RFQ logic executed. Local client opened." };
    }
}
