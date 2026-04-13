import { CreateMLCEngine, MLCEngine } from "@mlc-ai/web-llm";
import type { InitProgressReport } from "@mlc-ai/web-llm";

// Small, fast model perfect for in-browser drafting and routing
const SELECTED_MODEL = "Llama-3.2-1B-Instruct-q4f32_1-MLC";
let engine: MLCEngine | null = null;

export const initWebLLM = async (onProgress?: (progress: InitProgressReport) => void) => {
    if (engine) return engine;

    console.log(`[WebLLM] Initializing local engine: ${SELECTED_MODEL}`);

    try {
        engine = await CreateMLCEngine(SELECTED_MODEL, {
            initProgressCallback: onProgress,
        });
        console.log("[WebLLM] Engine initialized successfully in browser memory.");
        return engine;
    } catch (err) {
        console.error("[WebLLM] Initialization failed:", err);
        throw err;
    }
};

export const chatWithWebLLM = async (prompt: string, context: string = "") => {
    if (!engine) {
        throw new Error("WebLLM Engine not initialized. Call initWebLLM() first.");
    }

    const messages = [
        { role: "system" as const, content: `You are a helpful desktop assistant. ${context}` },
        { role: "user" as const, content: prompt }
    ];

    const reply = await engine.chat.completions.create({
        messages,
    });

    return reply.choices[0].message.content;
};
