import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 1. Extract data from the frontend request
    const { model, system, messages, max_tokens } = await req.json();
    
    // 2. Grab the API Key from the Vercel Environment Variables
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      console.error("API Error: OPENROUTER_API_KEY is missing from environment.");
      return NextResponse.json(
        { error: "API Key not found on server. Check Vercel Environment Variables." },
        { status: 500 }
      );
    }

    // 3. Talk to OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000", // Required by some OpenRouter models
        "X-Title": "NEXUS Evolve",
      },
      body: JSON.stringify({
        // Using Gemini Flash Lite as the default because it has more stable free-tier limits
        model: model || "google/gemini-2.0-flash-lite-preview-02-05:free",
        messages: [
          { role: "system", content: system || "You are NEXUS, a helpful AI assistant." },
          ...messages
        ],
        max_tokens: max_tokens || 1000,
      }),
    });

    // 4. Handle non-OK responses (like your 429)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenRouter Error Details:", errorData);
      
      return NextResponse.json(
        { 
          error: errorData.error?.message || `OpenRouter returned status ${response.status}`,
          code: response.status 
        }, 
        { status: response.status }
      );
    }

    const data = await response.json();

    // 5. Final check of the data structure
    if (!data.choices || !data.choices[0]) {
      return NextResponse.json({ error: "Invalid response format from AI provider." }, { status: 500 });
    }

    return NextResponse.json({ 
      content: data.choices[0].message.content 
    });

  } catch (error: any) {
    console.error("Internal Server Error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred." }, 
      { status: 500 }
    );
  }
}