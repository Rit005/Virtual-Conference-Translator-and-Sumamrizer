import React, { useEffect, useState } from "react";
import { useSocket } from "../../contexts/WebSocketContext.jsx";
import { useLiveAudio } from "../../hooks/useLiveAudio";

const ConferenceDashboard = () => {
  const socket = useSocket();
  const [captions, setCaptions] = useState([]);
  const [connected, setConnected] = useState(false);

  useLiveAudio(socket, connected);

  useEffect(() => {
    if (!socket) return;

    socket.on("connect", () => setConnected(true));

    socket.on("caption", (text) => {
      setCaptions((prev) => [...prev.slice(-10), text]);
    });

    return () => {
      socket.off("caption");
    };
  }, [socket]);

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Live Captions</h2>

      <div className="border p-4 rounded bg-gray-50 min-h-[150px]">
        {captions.length === 0 ? (
          <p className="text-gray-500">Speak to see captions…</p>
        ) : (
          captions.map((c, i) => (
            <p key={i} className="text-lg">
              {c}
            </p>
          ))
        )}
      </div>
    </div>
  );
};

export default ConferenceDashboard;