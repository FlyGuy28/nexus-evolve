import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // 1. Validate the API Key exists
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HUGGINGFACE_API_KEY is missing from environment variables." }, { status: 500 });
  }

  try {
    const { messages, system } = await req.json();

    // Replace the Mistral-Nemo line with this one:
    const model = "HuggingFaceTB/SmolLM2-1.7B-Instruct";

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "x-wait-for-model": "true" // Important: Wakes the model up if it's sleeping
        },
        body: JSON.stringify({
          inputs: `<s>[INST] ${system || "You are NEXUS, a helpful AI."} ${messages[messages.length - 1].content} [/INST]`,
          parameters: {
            max_new_tokens: 800,
            temperature: 0.7,
            top_p: 0.95,
            return_full_text: false
          }
        }),
      }
    );

    // 2. Prevent the "HTML instead of JSON" crash
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const errorText = await response.text();
      console.error("API returned non-JSON:", errorText.substring(0, 100));
      return NextResponse.json({ 
        error: "The AI service is currently waking up or unavailable. Please wait 10 seconds and try again." 
      }, { status: 503 });
    }

    const result = await response.json();

    // 3. Handle Hugging Face errors (like 429 or 503)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: response.status });
    }

    // 4. Extract and clean the AI's answer
    if (Array.isArray(result) && result[0]?.generated_text) {
      // Mistral usually appends the answer after the prompt; we trim it
      const cleanOutput = result[0].generated_text.trim();
      return NextResponse.json({ content: cleanOutput });
    }

    return NextResponse.json({ error: "The AI returned an empty response." }, { status: 500 });

  } catch (err: any) {
    console.error("Critical Route Error:", err);
    return NextResponse.json({ error: "Internal Server Error: " + err.message }, { status: 500 });
  }
}