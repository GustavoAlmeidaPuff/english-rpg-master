"use client";

import { useState, useRef, useCallback } from "react";

export type SpeechState = "idle" | "loading" | "speaking" | "error";

function sanitize(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function useSpeech() {
  const [state, setState] = useState<SpeechState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setState("idle");
  }, []);

  const speak = useCallback(
    async (text: string) => {
      stop();

      const cleaned = sanitize(text);
      if (!cleaned) return;

      setState("loading");

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleaned }),
        });

        if (!res.ok) {
          console.error("TTS request failed:", res.status);
          setState("error");
          return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.oncanplay = () => setState("speaking");
        audio.onended = () => {
          URL.revokeObjectURL(url);
          objectUrlRef.current = null;
          audioRef.current = null;
          setState("idle");
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          objectUrlRef.current = null;
          audioRef.current = null;
          setState("error");
        };

        await audio.play();
      } catch (err) {
        console.error("TTS error:", err);
        setState("error");
      }
    },
    [stop]
  );

  return {
    speak,
    stop,
    isSpeaking: state === "speaking",
    isLoading: state === "loading",
    isSupported: true,
  };
}
