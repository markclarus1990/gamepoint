"use client";
import { useState } from "react";

export default function Page() {
  const [amount, setAmount] = useState(0);
  const [name, setName] = useState("");
  const [points, setPoints] = useState(0);
  const [redeem, setRedeem] = useState(20);

  const loadUser = async () => {
    const res = await fetch(`/api/user?name=${name}`);
    const data = await res.json();
    setPoints(data.points);
  };

  const redeemPoints = async () => {
    const res = await fetch("/api/redeem", {
      method: "POST",
      body: JSON.stringify({ name, points: redeem }),
    });

    const data = await res.json();
    if (data.error) return alert(data.error);

    alert("Request sent!");
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">GamePoint</h1>

      <input
        className="border p-2"
        placeholder="Enter name"
        onChange={(e) => setName(e.target.value)}
      />

      <button onClick={loadUser}>Load</button>

      <div>Points: {points}</div>

      <input
        type="number"
        value={redeem}
        onChange={(e) => setRedeem(Number(e.target.value))}
      />

      <div>Reward: {(redeem / 20) * 8} mins</div>

      <button onClick={redeemPoints}>Redeem</button>
      <button
  onClick={async () => {
    const res = await fetch("/api/user", {
      method: "POST",
      body: JSON.stringify({ name }),
    });

    const data = await res.json();
    if (data.error) return alert(data.error);

    alert("User created!");
  }}
>
  Create User
</button>
    </div>
  );
}