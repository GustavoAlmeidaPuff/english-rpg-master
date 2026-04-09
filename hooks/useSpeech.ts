"use client";

import { useState, useRef, useCallback } from "react";

export type ModelStatus = "idle" | "loading" | "ready" | "error";

function sanitize(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")       // **bold**
    .replace(/\*(.+?)\*/g, "$1")            // *italic*
    .replace(/_(.+?)_/g, "$1")              // _italic_
    .replace(/^#{1,6}\s+/gm, "")            // # headers
    .replace(/`{1,3}[^`]*`{1,3}/g, "")      // `code`
    .replace(/\[.*?\]/g, "")                 // [stage directions]
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Singleton — model is loaded once and shared across all hook instances
let ttsPromise: Promise<unknown> | null = null;

async function getKokoro() {
  if (!ttsPromise) {
    ttsPromise = (async () => {
      const { KokoroTTS } = await import("kokoro-js");
      return KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: "q8",
        device: "wasm",
      });
    })();
  }
  return ttsPromise;
}

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stop = useCallback(() => {
    try {
      sourceRef.current?.stop();
    } catch {
      // ignore if already stopped
    }
    sourceRef.current = null;
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      stop();

      const cleaned = sanitize(text);
      if (!cleaned) return;

      // Load model on first use
      if (modelStatus !== "ready") {
        setModelStatus("loading");
        try {
          await getKokoro();
          setModelStatus("ready");
        } catch (err) {
          console.error("Failed to load Kokoro TTS model:", err);
          setModelStatus("error");
          return;
        }
      }

      setIsSpeaking(true);

      try {
        const tts = await getKokoro() as {
          generate: (text: string, opts: { voice: string }) => Promise<{
            audio: Float32Array;
            sampling_rate: number;
          }>;
        };

        const result = await tts.generate(cleaned, { voice: "bm_george" });

        // Play via Web Audio API
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
        }
        const ctx = audioCtxRef.current;

        const buffer = ctx.createBuffer(
          1,
          result.audio.length,
          result.sampling_rate
        );
        buffer.copyToChannel(result.audio, 0);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => {
          sourceRef.current = null;
          setIsSpeaking(false);
        };
        sourceRef.current = source;
        source.start();
      } catch (err) {
        console.error("TTS generation error:", err);
        setIsSpeaking(false);
      }
    },
    [stop, modelStatus]
  );

  return { speak, stop, isSpeaking, isSupported: true, modelStatus };
}
