import Groq from 'groq-sdk';

export const chatWithGroq = async (apiKey: string, prompt: string, systemPrompt: string) => {
    const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });

    const completion = await groq.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
        ],
        model: "llama3-70b-8192", // Updated model per Groq deprecation
        max_tokens: 1500, // Token optimization
        temperature: 0.1, // High logic determination
    });

    return completion.choices[0]?.message?.content || "";
};
