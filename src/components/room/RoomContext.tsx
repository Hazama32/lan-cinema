"use client";

import { createContext, useContext, type RefObject } from "react";
import type { useWatchRoom } from "@/lib/useWatchRoom";

export type RoomCtx = {
  roomCode: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  room: ReturnType<typeof useWatchRoom>;
};

export const RoomContext = createContext<RoomCtx | null>(null);
export const useRoomCtx = () => useContext(RoomContext);