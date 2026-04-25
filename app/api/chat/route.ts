import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { system, messages } = await req.json();
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Hugging Face Key missing" }, { status: 500 });
    }

    // Using DeepSeek-R1-Distill-Llama-8B (One of the best free performers right now)
    const model = "deepseek-ai/DeepSeek-R1-Distill-Llama-8B";

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Hugging Face standard text-gen format
          inputs: `<|system|>\n${system || "You are NEXUS."}\n<|user|>\n${messages[messages.length - 1].content}\n<|assistant|>`,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.7,
            return_full_text: false
          }
        }),
      }
    );

    const result = await response.json();

    // Hugging Face returns an array: [{ "generated_text": "..." }]
    if (Array.isArray(result) && result[0]?.generated_text) {
      return NextResponse.json({ content: result[0].generated_text });
    } else {
      console.error("HF Error:", result);
      return NextResponse.json({ error: "HF API Error", details: result }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}