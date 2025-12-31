import { useEffect, useRef } from "react";

export const useLiveAudio = (socket, enabled) => {
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    if (!enabled || !socket) return;

    const startAudio = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      sourceRef.current =
        audioContextRef.current.createMediaStreamSource(stream);

      processorRef.current = audioContextRef.current.createScriptProcessor(
        4096,
        1,
        1
      );

      processorRef.current.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        socket.emit("audio_chunk", Array.from(data));
      };

      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
    };

    startAudio();

    return () => {
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      audioContextRef.current?.close();
    };
  }, [socket, enabled]);
};