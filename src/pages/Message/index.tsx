import React, { useState } from "react";

interface Message {
  text: string;
  timestamp: Date;
}

export default function MessageApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (input.trim() !== "") {
      setMessages([...messages, { text: input, timestamp: new Date() }]);
      setInput("");
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 border rounded shadow-md">
      <h1 className="text-xl font-bold mb-4">Simple Message App</h1>
      <div className="h-64 overflow-y-scroll border p-2 mb-4 bg-gray-50">
        {messages.map((msg, idx) => (
          <div key={idx} className="mb-2">
            <div className="text-sm text-gray-600">{msg.timestamp.toLocaleTimeString()}</div>
            <div className="p-2 bg-blue-100 rounded-md inline-block">{msg.text}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 border rounded px-2 py-1"
          placeholder="Type your message"
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          onClick={sendMessage}
          className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600"
        >
          Send
        </button>
      </div>
    </div>
  );
}
