import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { messages, system, model } = await req.json();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000", // Required by OpenRouter
        "X-Title": "Nexus Evolve",              // Identifies your app
      },
      body: JSON.stringify({
        model: model || "qwen/qwen3-coder:free",
        messages: [
          { role: "system", content: system },
          ...messages
        ],
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || "OpenRouter Error" }, 
        { status: response.status }
      );
    }

    // Extract content from the OpenRouter response format
    const content = data.choices[0].message.content;
    
    return NextResponse.json({ content });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}