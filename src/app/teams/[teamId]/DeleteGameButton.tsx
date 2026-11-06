"use client";

import { useTransition } from "react";
import { deleteGame } from "./actions";

export function DeleteGameButton({ teamId, gameId, label }: { teamId: string; gameId: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Delete ${label}? All hustle points recorded for this game will be deleted too. This can't be undone.`)) return;
        start(() => deleteGame(teamId, gameId));
      }}
      className="text-sm font-semibold text-muted underline underline-offset-4 hover:text-red disabled:opacity-50"
    >
      {pending ? "Deleting..." : "Delete game"}
    </button>
  );
}
