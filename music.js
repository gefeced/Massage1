"use strict";

/**
 * Music: simple playlist player using real audio files from `/music`.
 * - Continues playing across routes (single Audio instance).
 * - Supports play/pause, skip (next track), seek, and volume.
 * - Persists volume via localStorage.
 */

(() => {
  const MG = (window.MassageGift = window.MassageGift || {});
  const Storage = MG.Storage;
  const { clamp, toFiniteNumber } = MG.Utils;
  const { showToast } = MG.UI;

  const TRACKS = [
    { id: "breath", title: "Breath", artist: "Local track", src: "music/Breath.mp3" },
    { id: "cinema", title: "Cinema", artist: "Local track", src: "music/Cinema.mp3" },
    { id: "slow-drift", title: "Slow Drift", artist: "Local track", src: "music/Slow Drift.mp3" },
  ];

  const audio = new Audio();
  audio.preload = "metadata";
  audio.loop = false;

  let trackIndex = 0;
  let volume = clamp(toFiniteNumber(Storage.getJson("musicVolume", 0.75), 0.75), 0, 1);
  audio.volume = volume;

  const listeners = new Set();

  function currentTrack() {
    return TRACKS[trackIndex] || TRACKS[0];
  }

  function effectiveDurationSec() {
    const d = toFiniteNumber(audio.duration, 0);
    return d > 0 ? d : 0;
  }

  function effectivePositionSec() {
    const t = toFiniteNumber(audio.currentTime, 0);
    return t >= 0 ? t : 0;
  }

  function getSnapshot() {
    return {
      track: currentTrack(),
      trackIndex,
      trackCount: TRACKS.length,
      isPlaying: !audio.paused && !audio.ended,
      positionSec: effectivePositionSec(),
      durationSec: effectiveDurationSec(),
      volume,
    };
  }

  function emit() {
    const snapshot = getSnapshot();
    for (const listener of listeners) listener(snapshot);
  }

  function onChange(listener) {
    listeners.add(listener);
    listener(getSnapshot());
    return () => listeners.delete(listener);
  }

  function setSourceForIndex(index) {
    trackIndex = ((index % TRACKS.length) + TRACKS.length) % TRACKS.length;
    const track = currentTrack();
    audio.src = encodeURI(track.src);
  }

  function ensureSource() {
    if (!audio.src) setSourceForIndex(trackIndex);
  }

  async function play() {
    ensureSource();
    try {
      await audio.play();
      emit();
    } catch {
      showToast({
        title: "Tap to play",
        message: "Your browser needs a click before it can start music.",
      });
    }
  }

  function pause() {
    audio.pause();
    emit();
  }

  function toggle() {
    if (audio.paused) void play();
    else pause();
  }

  function seek(seconds) {
    ensureSource();
    const duration = effectiveDurationSec();
    const next = clamp(toFiniteNumber(seconds, 0), 0, duration || 0);
    audio.currentTime = next;
    emit();
  }

  function next() {
    const shouldAutoPlay = !audio.paused;
    const nextIndex = trackIndex + 1;
    setSourceForIndex(nextIndex);
    audio.currentTime = 0;
    emit();
    if (shouldAutoPlay) void play();
  }

  function restart() {
    seek(0);
    if (audio.paused) void play();
  }

  function setVolume(nextVolume) {
    volume = clamp(toFiniteNumber(nextVolume, volume), 0, 1);
    audio.volume = volume;
    Storage.setJson("musicVolume", volume);
    emit();
  }

  audio.addEventListener("timeupdate", emit);
  audio.addEventListener("durationchange", emit);
  audio.addEventListener("play", emit);
  audio.addEventListener("pause", emit);
  audio.addEventListener("ended", () => {
    // Auto-advance at end (Spotify-like).
    next();
  });
  audio.addEventListener("loadedmetadata", emit);

  // Initialize source lazily (after a user gesture).
  // But set a default now so the UI has the right title.
  setSourceForIndex(0);

  MG.Music = {
    tracks: TRACKS,
    onChange,
    getSnapshot,
    play,
    pause,
    toggle,
    seek,
    next,
    restart,
    setVolume,
  };
})();
