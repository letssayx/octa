export const chatWithHuggingFace = async (apiKey: string, prompt: string, systemPrompt: string, model: string = "meta-llama/Llama-3.1-8B-Instruct") => {
    try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}/v1/chat/completions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 1500
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HuggingFace API error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "";
    } catch (error) {
        console.error("HuggingFace fetch error:", error);
        throw error;
    }
};