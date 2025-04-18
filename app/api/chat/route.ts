import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

// Initialize OpenAI client with DeepSeek configuration
const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

// Request body validation schema
const requestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
  }))
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = requestSchema.safeParse(body);
    if (!validated.success) {
      console.error("Invalid request body:", validated.error);
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 });
    }
    const { messages } = validated.data;

    // --- Call OpenAI/DeepSeek ---
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant. Follow these rules:
            1. Respond concisely.
            2. Avoid markdown formatting (like * or #).
            3. If you create a numbered or bulleted list, **start each item on a new line**. For example:
               1. First item.
               2. Second item.
               - Bullet one.
               - Bullet two.
            4. Keep responses under 500 tokens.`
        },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      stream: false
    });

    const rawResponse = completion.choices[0]?.message?.content;

    if (!rawResponse) {
      return NextResponse.json(
        { error: "Empty response from AI" },
        { status: 500 }
      );
    }

    // --- Clean the response (Keep existing cleaning) ---
    // Note: Explicit newline instruction is better than trying to regex-replace lists later.
    const cleanResponse = rawResponse
      // .replace(/[#*]/g, '') // Keep or remove depending on if AI still adds them
      .replace(/\n{2,}/g, '\n') // Keep collapsing multiple blank lines
      .trim();

    // --- Directly return the AI response ---
    return NextResponse.json({
      response: cleanResponse
    });

  } catch (error: any) {
    console.error('API Error:', error);
     if (error instanceof z.ZodError) {
         return NextResponse.json(
             { error: "Invalid request format", details: error.errors },
             { status: 400 }
         );
     }
    return NextResponse.json(
      { error: error.message || "Error processing request" },
      { status: 500 }
    );
  }
}
