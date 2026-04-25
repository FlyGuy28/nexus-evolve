import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // SAFE GUARD: Check key before doing ANYTHING
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ 
      error: "The API Key is missing on the server! Go to Vercel Settings > Environment Variables." 
    }, { status: 500 });
  }

  try {
    const { messages, system } = await req.json();
    const model = "mistralai/Mistral-7B-Instruct-v0.3";

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "x-wait-for-model": "true"
        },
        body: JSON.stringify({
          inputs: `<s>[INST] ${system || "You are NEXUS."} ${messages[messages.length - 1].content} [/INST]`,
          parameters: { max_new_tokens: 500 }
        }),
      }
    );

    const result = await response.json();

    // If HF is overloaded, it returns an error object
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    if (Array.isArray(result) && result[0]?.generated_text) {
      const output = result[0].generated_text.split('[/INST]').pop();
      return NextResponse.json({ content: output.trim() });
    }

    return NextResponse.json({ error: "Unexpected response format from HF" }, { status: 500 });

  } catch (err: any) {
    return NextResponse.json({ error: "Internal Crash: " + err.message }, { status: 500 });
  }
}