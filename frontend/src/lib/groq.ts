import Groq from 'groq-sdk';

export const chatWithGroq = async (apiKey: string, prompt: string, systemPrompt: string) => {
    const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });

    const completion = await groq.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
        ],
        model: "llama-3.3-70b-versatile", // Updated model per Groq deprecation
        max_tokens: 1500, // Token optimization
        temperature: 0.1, // High logic determination
    });

    return completion.choices[0]?.message?.content || "";
};
