"use client";

import { useState } from "react";

export default function VoiceInput({ onText }: { onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const recognition = new window.webkitSpeechRecognition();

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    onText(text);
  };

  const startListening = () => {
    setListening(true);
    recognition.start();
  };

  return (
    <button onClick={startListening} className="p-2 bg-blue-500 text-white rounded">
      {listening ? "Listening..." : "Speak"}
    </button>
  );
}
