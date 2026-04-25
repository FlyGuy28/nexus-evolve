import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // 1. Initial Safeguard: Check for the API Key
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ 
      error: "API Key is missing. Add HUGGINGFACE_API_KEY to Vercel and .env.local" 
    }, { status: 500 });
  }

  try {
    const { messages, system } = await req.json();

    // The official Hugging Face path for Kimi K2.6
    const model = "moonshotai/Kimi-K2.6";

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "x-wait-for-model": "true" // CRITICAL: Keeps the request alive while Kimi "wakes up"
        },
        body: JSON.stringify({
          // Kimi uses standard chat templates, but we'll format the prompt clearly
          inputs: `<|im_start|>system\n${system || "You are NEXUS, a helpful assistant."}<|im_end|>\n<|im_start|>user\n${messages[messages.length - 1].content}<|im_end|>\n<|im_start|>assistant\n`,
          parameters: {
            max_new_tokens: 1000,
            temperature: 0.7,
            return_full_text: false
          }
        }),
      }
    );

    // 2. Handle non-JSON (HTML) responses
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const textError = await response.text();
      console.error("Non-JSON Response received:", textError.substring(0, 200));
      return NextResponse.json({ 
        error: "API returned HTML instead of JSON. The model might be temporarily unavailable or the URL is incorrect.",
        status: response.status 
      }, { status: 500 });
    }

    const result = await response.json();

    // 3. Handle Hugging Face specific error codes
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: response.status || 500 });
    }

    // 4. Parse the output (Kimi/Hugging Face returns an array)
    if (Array.isArray(result) && result[0]?.generated_text) {
      let output = result[0].generated_text;
      
      // Clean up any remaining chat tokens if the model left them in
      output = output.replace("<|im_end|>", "").replace("<|im_start|>", "").trim();
      
      return NextResponse.json({ content: output });
    }

    return NextResponse.json({ error: "Unexpected response format from Kimi API" }, { status: 500 });

  } catch (err: any) {
    console.error("Route Crash:", err);
    return NextResponse.json({ error: "Internal Server Crash: " + err.message }, { status: 500 });
  }
}