import { NextRequest } from "next/server";

// Model is loaded once and kept in memory between requests
let ttsInstance: unknown = null;

async function getTTS() {
  if (!ttsInstance) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KokoroTTS } = await import("kokoro-js");
    ttsInstance = await KokoroTTS.from_pretrained(
      "onnx-community/Kokoro-82M-v1.0-ONNX",
      { dtype: "q8", device: "cpu" }
    );
  }
  return ttsInstance as {
    generate: (
      text: string,
      opts: { voice: string }
    ) => Promise<{ audio: Float32Array; sampling_rate: number }>;
  };
}

/** Encode PCM Float32 samples as a 16-bit WAV buffer */
function encodeWav(samples: Float32Array, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, 28);
  buf.writeUInt16LE((numChannels * bitsPerSample) / 8, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }

  return buf;
}

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text || typeof text !== "string") {
    return new Response("Missing text", { status: 400 });
  }

  try {
    const tts = await getTTS();
    const result = await tts.generate(text, { voice: "bm_george" });
    const wav = encodeWav(result.audio, result.sampling_rate);

    return new Response(wav, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Kokoro TTS error:", err);
    return new Response("TTS failed", { status: 500 });
  }
}
