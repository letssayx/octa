import Groq from 'groq-sdk';

export const chatWithGroq = async (apiKey: string, prompt: string, systemPrompt: string) => {
    const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });

    const completion = await groq.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
        ],
        model: "llama-3.1-70b-versatile", // Cost effective, high logic capabilities
        max_tokens: 1500, // Token optimization
        temperature: 0.1, // High logic determination
    });

    return completion.choices[0]?.message?.content || "";
};
