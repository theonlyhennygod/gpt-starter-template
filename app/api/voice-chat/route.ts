import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
// --- START: Uncomment these lines ---
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
// --- END: Uncomment these lines ---

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const audioFile = formData.get('audio') as File | null
        const prevMessages = formData.get('messages') as string | null

        // --- START DEBUG LOGGING (Backend Reception) ---
        console.log("Received FormData Keys:", Array.from(formData.keys()));
        console.log("Received Audio File Details:", {
            name: audioFile?.name,
            size: audioFile?.size,
            type: audioFile?.type
        });
        // --- END DEBUG LOGGING ---

        if (!audioFile || audioFile.size < 100) { // Basic check for file presence and minimal size
            console.error("Audio file missing or empty in FormData.");
            return NextResponse.json(
                { error: 'No valid audio file received' },
                { status: 400 }
            )
        }

        // --- START: Uncomment this block to save the file ---
        const tempDir = path.join(os.tmpdir(), 'chatbot-audio-uploads'); // Define a sub-directory
        const tempFilePath = path.join(tempDir, `upload_${Date.now()}_${audioFile.name}`);
        try {
            await fs.mkdir(tempDir, { recursive: true }); // Ensure the directory exists
            const buffer = Buffer.from(await audioFile.arrayBuffer());
            await fs.writeFile(tempFilePath, buffer);
            console.log(`Audio saved temporarily for inspection to: ${tempFilePath}`);
        } catch (saveError) {
            console.error("Error saving temporary audio file:", saveError);
            // Continue processing even if saving fails, but log the error
        }
        // --- END: Uncomment this block ---

        // First, transcribe the audio
        let transcriptionText = ""
        try {
            console.log("Sending audio to Whisper API...")
            const transcription = await openai.audio.transcriptions.create({
                file: audioFile, // Pass the received File object directly
                model: 'whisper-1',
                language: 'en' // Optional: remove if you want auto-detect
            })

            // --- START DEBUG LOGGING (Whisper Response) ---
            console.log("Whisper API Full Response:", JSON.stringify(transcription, null, 2));
            transcriptionText = transcription.text;
            console.log("Whisper Transcription Text:", transcriptionText);
            // --- END DEBUG LOGGING ---

            if (transcriptionText === undefined || transcriptionText === null || transcriptionText.trim() === "") {
                console.error("Transcription result is empty/invalid:", transcriptionText);
                // Decide how to handle: return error or default text?
                // Let's return an error for clarity
                return NextResponse.json(
                    { error: 'Failed to get valid transcription from audio', detail: "Whisper returned empty text." },
                    { status: 500 }
                )
            }

        } catch (transcriptionError: any) {
            console.error("Error calling Whisper API:", transcriptionError);
            // Provide more details if possible from the error object
            const errorMessage = transcriptionError?.response?.data?.error?.message || transcriptionError.message || "Unknown transcription error";
            return NextResponse.json(
                { error: 'Failed to transcribe audio', detail: errorMessage },
                { status: 500 }
            )
        }

        // Then, send the transcribed text to chat
        const messages = prevMessages ? JSON.parse(prevMessages) : []
        messages.push({ role: 'user', content: transcriptionText }) // Use the validated transcriptionText

        let reply = ''
        try {
            console.log(`Sending ${messages.length} messages to Chat API... First user message: ${messages[messages.length - 1]?.content}`);
            const chatResponse = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo', // Or your preferred chat model
                messages: messages.map(({ role, content }: { role: string, content: string }) => ({ role, content })),
                temperature: 0.7,
                max_tokens: 500
            })
            reply = chatResponse.choices[0]?.message?.content?.trim() || '' // Trim reply
            console.log("Chat API Reply:", reply);

        } catch (chatError: any) {
            console.error("Error calling Chat API:", chatError);
            const errorMessage = chatError?.response?.data?.error?.message || chatError.message || "Unknown chat completion error";
            // Still return the transcription even if chat fails
            return NextResponse.json({
                transcription: transcriptionText,
                reply: `(Error getting AI reply: ${errorMessage})` // Send transcription + error message
            });
        }

        return NextResponse.json({
            transcription: transcriptionText,
            reply: reply || "(AI did not provide a reply)" // Handle empty reply
        });
    } catch (error: any) { // Catch errors from formData parsing etc.
        console.error('Voice chat outer error:', error);
        return NextResponse.json(
            { error: error.message || 'Error processing voice chat' },
            { status: 500 }
        );
    }
} 