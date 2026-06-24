"use client";

import { useState } from "react";
import { toast } from "react-toastify";

export default function ChangePassword() {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");

  const handleChange = async () => {
    const stored = JSON.parse(localStorage.getItem("user") ?? "{}");

    const res = await fetch("/api/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: stored.id,
        oldPin,
        newPin,
      }),
    });

    const data = await res.json();

    if (data.error) {
      toast.error(data.error);
    } else {
      toast.success("PIN updated!");
      window.location.href = "/home";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="bg-gray-900 p-6 rounded-xl w-full max-w-sm space-y-4">
        <h2 className="text-lg font-semibold text-center">
          Change PIN
        </h2>

        <input
          type="password"
          placeholder="Old PIN"
          value={oldPin}
          onChange={(e) => setOldPin(e.target.value)}
          className="w-full p-3 rounded bg-gray-800"
        />

        <input
          type="password"
          placeholder="New PIN (4 digits)"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          className="w-full p-3 rounded bg-gray-800"
        />

        <button
          onClick={handleChange}
          className="w-full p-3 bg-purple-600 rounded"
        >
          Update PIN
        </button>
      </div>
    </div>
  );
}