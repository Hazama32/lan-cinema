"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { getSocket, measureClockOffset } from "./socket";

export type RoomState = { playing: boolean; pos: number; at: number; rate: number };
export type RoomInfo = {
  members: { id: string; name: string }[];
  hostId: string;
  hostOnly: boolean;
};
type JoinAck = { error: string } | ({ mediaId: number; state: RoomState } & RoomInfo);

const DRIFT_LIMIT = 0.5; // detik

export function useWatchRoom(
  videoRef: RefObject<HTMLVideoElement | null>,
  code: string | null,
  mediaId: number,
) {
  const [status, setStatus] = useState<"idle" | "connecting" | "joined" | "error">("idle");
  const [error, setError] = useState("");
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [myId, setMyId] = useState("");
  const [needTap, setNeedTap] = useState(false);
  const [drift, setDrift] = useState<number | null>(null);
  const ctl = useRef({
    state: null as RoomState | null,
    offset: 0,
    ignoreUntil: 0,
    seekGuard: false,
    isHost: false,
    hostOnly: false,
  });

  useEffect(() => {
    const v = videoRef.current;
    if (!code || !v) return;
    const s = getSocket();
    const R = ctl.current;
    let cancelled = false;
    Object.assign(R, { state: null, ignoreUntil: 0, seekGuard: false, isHost: false, hostOnly: false });

    const serverNow = () => Date.now() + R.offset;
    const target = (st: RoomState) =>
      st.playing ? st.pos + ((serverNow() - st.at) / 1000) * st.rate : st.pos;

    // Loncat posisi; tandai agar event "seeked" hasil loncatan ini tidak dikirim balik
    const seekTo = (t: number) => {
      R.seekGuard = true;
      setTimeout(() => (R.seekGuard = false), 3000);
      v.currentTime = Math.max(0, t);
    };

    // Terapkan state room ke elemen video
    const apply = (st: RoomState) => {
      R.state = st;
      if (v.readyState < 1) return; // metadata belum siap, diterapkan saat loadedmetadata
      R.ignoreUntil = Date.now() + 800; // abaikan event play/pause/rate yang kita picu sendiri
      const t = target(st);
      if (Math.abs(v.currentTime - t) > 0.3) seekTo(t);
      if (v.playbackRate !== st.rate) v.playbackRate = st.rate;
      if (st.playing && v.paused) v.play().catch(() => setNeedTap(true));
      else if (!st.playing && !v.paused) v.pause();
    };

    // Aksi pengguna lokal -> kirim ke room
    const send = (action: "play" | "pause" | "seek" | "rate") => {
      if (Date.now() < R.ignoreUntil || !R.state) return;
      if (R.hostOnly && !R.isHost) {
        apply(R.state); // bukan host: kembalikan ke state room
        return;
      }
      s.emit("room:control", { action, pos: v.currentTime, rate: v.playbackRate });
    };

    const onPlay = () => send("play");
    const onPause = () => {
      // Layar HP terkunci / tab disembunyikan -> browser menjeda video sendiri.
      // Itu bukan keinginan pengguna, jangan siarkan ke seluruh room.
      if (!v.ended && document.visibilityState === "visible") send("pause");
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && R.state) apply(R.state);
    };
    const onSeeked = () => {
      if (R.seekGuard) {
        R.seekGuard = false;
        return;
      }
      send("seek");
    };
    const onRate = () => send("rate");
    const onMeta = () => {
      if (R.state) apply(R.state);
    };
    const onPlaying = () => setNeedTap(false);

    const join = () => {
      setStatus("connecting");
      s.emit("room:join", { code }, (res: JoinAck) => {
        if (cancelled) return;
        if ("error" in res) {
          setStatus("error");
          setError(res.error);
          return;
        }
        if (res.mediaId !== mediaId) {
          setStatus("error");
          setError("Room ini sedang memutar film lain.");
          return;
        }
        setMyId(s.id ?? "");
        R.isHost = res.hostId === s.id;
        R.hostOnly = res.hostOnly;
        setInfo({ members: res.members, hostId: res.hostId, hostOnly: res.hostOnly });
        setError("");
        setStatus("joined");
        apply(res.state);
      });
    };

    // Ukur selisih jam dulu, baru masuk room
    const start = () => {
      measureClockOffset(s, 5)
        .then((m) => {
          R.offset = m.offset;
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) join();
        });
    };

    const onState = (m: { state: RoomState }) => apply(m.state);
    const onInfo = (i: RoomInfo) => {
      R.isHost = i.hostId === s.id;
      R.hostOnly = i.hostOnly;
      setInfo(i);
    };
    const onDisconnect = () => setStatus("connecting");

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("ratechange", onRate);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("playing", onPlaying);
    document.addEventListener("visibilitychange", onVisible);
    s.on("room:state", onState);
    s.on("room:info", onInfo);
    s.on("disconnect", onDisconnect);
    s.on("connect", start); // juga berjalan saat sambung ulang -> masuk room lagi
    if (s.connected) start();

    const resync = setInterval(() => {
      measureClockOffset(s, 3)
        .then((m) => {
          R.offset = m.offset;
        })
        .catch(() => {});
    }, 30000);

    const driftTimer = setInterval(() => {
      const st = R.state;
        if (!st || !st.playing || v.paused || v.seeking || v.readyState < 3) {
        setDrift(null);
        return;
      }
      const d = v.currentTime - target(st);
      setDrift(d);
      if (Math.abs(d) > DRIFT_LIMIT) {
        console.log(`[room] drift ${d.toFixed(2)}s -> koreksi`);
        R.ignoreUntil = Date.now() + 800;
        seekTo(target(st));
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(resync);
      clearInterval(driftTimer);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("ratechange", onRate);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("playing", onPlaying);
      document.removeEventListener("visibilitychange", onVisible);
      s.off("room:state", onState);
      s.off("room:info", onInfo);
      s.off("disconnect", onDisconnect);
      s.off("connect", start);
      s.emit("room:leave");
    };
  }, [code, mediaId, videoRef]);

  const resume = () => {
    const v = videoRef.current;
    if (!v) return;
    ctl.current.ignoreUntil = Date.now() + 800;
    v.play().catch(() => {});
    setNeedTap(false); // posisi dirapikan oleh koreksi drift dalam ≤ 2 detik
  };
  const setHostOnly = (value: boolean) => getSocket().emit("room:hostonly", { value });

  return {
    status,
    error,
    info,
    needTap,
    drift,
    myId,
    resume,
    setHostOnly,
    isHost: !!info && info.hostId === myId,
  };
}