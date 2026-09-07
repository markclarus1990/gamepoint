"use client";

import { useState, useCallback, useEffect } from "react";
import { Users, X, Award } from "lucide-react";
import { NBA_TEAMS, TEAM_CONFERENCES, getTeamLogo } from "@/lib/constants/nba";

interface TeamInfo {
  name: string;
  conference: "East" | "West";
  division: string;
}

export default function NbaTeamSelector({
  onTeamSelected,
  availableTeams = [...NBA_TEAMS],
  mode = "register",
}: {
  onTeamSelected: (team: string, conference: "East" | "West", division: string) => void;
  availableTeams?: string[];
  mode?: "register" | "bracket";
}) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [teamsLeft, setTeamsLeft] = useState(availableTeams?.length || 0);

  useEffect(() => {
    setTeamsLeft(availableTeams.length);
  }, [availableTeams.length]);

  const handleTeamChange = useCallback(
    (team: string) => {
      const teamInfo = TEAM_CONFERENCES[team];
      setSelectedTeam(team);
      // don't call onTeamSelected yet — wait for confirm, but keep for bracket preview
      if (mode === "bracket" && teamInfo) {
        onTeamSelected(team, teamInfo.conference, teamInfo.division);
      }
    },
    [onTeamSelected, mode]
  );

  const handleConfirm = useCallback(() => {
    if (!selectedTeam) return;
    const info = TEAM_CONFERENCES[selectedTeam];
    onTeamSelected(selectedTeam, info?.conference || "East", info?.division || "Unknown");
    setShowModal(false);
    // keep selectedTeam showing as "Your pick" until parent clears
  }, [selectedTeam, onTeamSelected]);

  const isTaken = (team: string) => !availableTeams.includes(team);

  return (
    <div className="space-y-4">
      {/* Team Selection Mode */}
      {mode === "register" && !selectedTeam && (
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-400" /> Select Your NBA Team
          </h3>
          <p className="text-gray-300 mb-6 text-sm">
            Choose your team for the NBA Playoff Tournament. Each team can only be selected once — <span className="text-orange-400 font-semibold">first come gets fav team</span> (1 player = 1 team).
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {NBA_TEAMS.map((team) => {
              const teamInfo = TEAM_CONFERENCES[team];
              const taken = isTaken(team);

              return (
                <button
                  key={team}
                  type="button"
                  disabled={taken}
                  onClick={() => !taken && handleTeamChange(team)}
                  className={`group relative rounded-xl border p-3 text-left transition-all flex flex-col items-center gap-2 ${
                    taken
                      ? "border-red-500/20 bg-zinc-900/30 cursor-not-allowed opacity-40"
                      : "border-zinc-700/60 bg-zinc-900/50 hover:border-orange-500/40 hover:bg-zinc-900 cursor-pointer hover:shadow-lg hover:shadow-orange-500/10"
                  }`}
                >
                  <img
                    src={getTeamLogo(team)}
                    alt={team}
                    loading="lazy"
                    className={`w-12 h-12 object-contain bg-white rounded-full p-1.5 border-2 ${taken ? "border-red-500/20 opacity-60 grayscale" : "border-zinc-700 group-hover:border-orange-400"}`}
                    onError={(e) => ((e.currentTarget.src = "/window.svg"))}
                  />
                  <span className={`text-xs text-center font-semibold leading-tight ${taken ? "text-red-300/60" : "text-gray-200"}`}>{team}</span>
                  {teamInfo && <span className={`text-[10px] px-2 py-0.5 rounded-full border ${teamInfo.conference === "East" ? "border-red-500/20 text-red-400 bg-red-500/10" : "border-blue-500/20 text-blue-400 bg-blue-500/10"}`}>{teamInfo.conference}</span>}
                  {taken && <span className="absolute top-1 right-1 text-[10px] font-bold text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded">TAKEN</span>}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800/50 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              <span className="text-white font-bold">{teamsLeft}</span> / {NBA_TEAMS.length} teams remaining
            </p>
            {teamsLeft <= 4 && teamsLeft > 0 && <p className="text-xs font-semibold text-red-400 animate-pulse">Few teams left! Secure your pick early.</p>}
            {teamsLeft === 0 && <p className="text-xs font-semibold text-red-400">Tournament full — 16 teams locked</p>}
          </div>
        </div>
      )}

      {/* Selected Team Display */}
      {selectedTeam && mode === "register" && (
        <div className="bg-zinc-900/70 backdrop-blur-md rounded-2xl p-6 border border-orange-500/20">
          <div className="flex items-center gap-4 mb-4">
            <img src={getTeamLogo(selectedTeam)} alt={selectedTeam} loading="lazy" className="w-12 h-12 object-contain bg-white rounded-full p-1.5 border border-orange-500/30" onError={(e) => ((e.currentTarget.src = "/window.svg"))} />
            <div className="flex-1">
              <p className="font-bold text-white">{selectedTeam}</p>
              <p className="text-sm text-gray-400">{TEAM_CONFERENCES[selectedTeam]?.conference} Conference · {TEAM_CONFERENCES[selectedTeam]?.division}</p>
            </div>
            <button onClick={() => setSelectedTeam(null)} className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1 border border-zinc-700 rounded-lg px-3 py-1.5">
              <X className="w-4 h-4" /> Change
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs mb-4">
            <div className={`rounded-lg px-3 py-2 border text-center font-semibold ${TEAM_CONFERENCES[selectedTeam]?.conference === "East" ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-blue-500/10 border-blue-500/20 text-blue-400"}`}>
              {TEAM_CONFERENCES[selectedTeam]?.conference} Conference
            </div>
            <div className="rounded-lg px-3 py-2 border border-zinc-700 bg-zinc-800/50 text-center font-semibold text-orange-300">
              {TEAM_CONFERENCES[selectedTeam]?.division || "Unknown"} Division
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setSelectedTeam(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-gray-300 font-medium hover:bg-zinc-800 transition-colors">
              Back
            </button>
            <button onClick={() => setShowModal(true)} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-600 to-red-500 hover:from-orange-500 hover:to-red-400 transition-all shadow-lg">
              Confirm {selectedTeam}
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {selectedTeam && showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">{mode === "register" ? "Confirm Team Selection" : "Team Selected"}</h3>
            <p className="text-gray-300 mb-1 text-sm">
              You have selected <span className="text-white font-bold">{selectedTeam}</span>.
            </p>
            <p className="text-gray-400 mb-6 text-xs">
              First-come rule: once confirmed, this team is locked to you (1 player = 1 team) and unavailable to others. You cannot change after confirmation when tournament starts at 16.
            </p>

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-gray-300 font-medium hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-600 to-red-500 hover:from-orange-500 hover:to-red-400 transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bracket Mode */}
      {mode === "bracket" && selectedTeam && (
        <div className="bg-zinc-900/50 backdrop-blur-md rounded-2xl p-6 border border-zinc-700/30">
          <h4 className="font-bold text-white mb-1 flex items-center gap-2">
            <Award className="w-4 h-4 text-yellow-400" /> Your Team: {selectedTeam}
          </h4>
          <p className="text-gray-300 text-sm">
            {TEAM_CONFERENCES[selectedTeam]?.conference} Conference, {TEAM_CONFERENCES[selectedTeam]?.division} Division.
          </p>
        </div>
      )}
    </div>
  );
}
