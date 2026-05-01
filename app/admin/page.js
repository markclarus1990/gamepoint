"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Admin() {
  const [requests, setRequests] = useState([]);

  const load = async () => {
    const { data } = await supabase
      .from("redeem_requests")
      .select("*, users(name)")
      .eq("status", "pending");

    setRequests(data);
  };

  const approve = async (r) => {
    await supabase
      .from("redeem_requests")
      .update({ status: "approved" })
      .eq("id", r.id);

    await supabase.rpc("decrement_points", {
      uid: r.user_id,
      pts: r.points_used,
    });

    load();
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6">
      <h1>Admin</h1>

      {requests.map((r) => (
        <div key={r.id}>
          {r.users?.name} - {r.points_used} pts → {r.minutes} mins
          <button onClick={() => approve(r)}>Approve</button>
        </div>
      ))}
    </div>
  );
}