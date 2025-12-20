"use strict";

/**
 * Data: placeholder content for massages/bundles + route titles.
 * This file is intentionally “dumb” (no DOM, no storage) so it’s easy to edit.
 */

(() => {
  const MG = (window.MassageGift = window.MassageGift || {});

  const DISPLAY_NAME = "Mary";

  /**
   * Massage & bundle definitions.
   * - `type: "massage"` => single step session
   * - `type: "bundle"`  => multi-step session (steps may be bundle-only)
   *
   * Note: We keep titles clean and show duration separately in UI.
   */
  const MASSAGES = [
    // Head Massages
    { id: "head-5", type: "massage", category: "Head", name: "Head Massage", durationMin: 5, costCredits: 1 },
    { id: "head-10", type: "massage", category: "Head", name: "Head Massage", durationMin: 10, costCredits: 2 },
    { id: "head-20", type: "massage", category: "Head", name: "Head Massage", durationMin: 20, costCredits: 4 },

    // Shoulder Massages
    { id: "shoulder-5", type: "massage", category: "Shoulders", name: "Shoulder Massage", durationMin: 5, costCredits: 1 },
    { id: "shoulder-15", type: "massage", category: "Shoulders", name: "Shoulder Massage", durationMin: 15, costCredits: 3 },

    // Foot Massages (One Foot)
    { id: "foot-one-10", type: "massage", category: "Feet (One Foot)", name: "Foot Massage (One Foot)", durationMin: 10, costCredits: 2 },
    { id: "foot-one-20", type: "massage", category: "Feet (One Foot)", name: "Foot Massage (One Foot)", durationMin: 20, costCredits: 4 },

    // Foot Massages (Both Feet)
    { id: "foot-both-5", type: "massage", category: "Feet (Both Feet)", name: "Foot Massage (Both Feet)", durationMin: 5, costCredits: 2 },
    { id: "foot-both-15", type: "massage", category: "Feet (Both Feet)", name: "Foot Massage (Both Feet)", durationMin: 15, costCredits: 4 },

    // Back Massages
    { id: "back-5", type: "massage", category: "Back", name: "Back Massage", durationMin: 5, costCredits: 1 },
    { id: "back-15", type: "massage", category: "Back", name: "Back Massage", durationMin: 15, costCredits: 4 },

    // Bundles
    {
      id: "bundle-starter",
      type: "bundle",
      category: "Bundle",
      name: "Starter Bundle",
      steps: [
        { name: "Foot Massage (One Foot)", durationMin: 5, bundleOnly: true },
        { name: "Head Massage", durationMin: 5 },
        { name: "Shoulder Massage", durationMin: 5 },
      ],
      costCredits: 3,
    },
    {
      id: "bundle-full",
      type: "bundle",
      category: "Bundle",
      name: "Full Bundle",
      steps: [
        { name: "Foot Massage (One Foot)", durationMin: 10 },
        { name: "Head Massage", durationMin: 7, bundleOnly: true },
        { name: "Shoulder Massage", durationMin: 5 },
        { name: "Back Massage", durationMin: 5 },
      ],
      costCredits: 6,
    },
    {
      id: "bundle-critical",
      type: "bundle",
      category: "Bundle",
      name: "Critical Bundle (Head & Feet Focus)",
      steps: [
        { name: "Foot Massage (One Foot)", durationMin: 16, bundleOnly: true },
        { name: "Head Massage", durationMin: 5 },
        { name: "Foot Massage", durationMin: 2, bundleOnly: true },
        { name: "Head Massage", durationMin: 8, bundleOnly: true },
      ],
      costCredits: 5,
    },
  ].map((item) => {
    if (item.type !== "bundle") return item;
    const durationMin = Array.isArray(item.steps)
      ? item.steps.reduce((sum, step) => sum + (Number(step.durationMin) || 0), 0)
      : 0;
    return { ...item, durationMin };
  });

  const ROUTES = {
    home: { title: "Home" },
    massages: { title: "Massages" },
    massage: { title: "Massage Details" },
    credits: { title: "Credits" },
    music: { title: "Music" },
    settings: { title: "Settings" },
  };

  function findMassageById(massageId) {
    return MASSAGES.find((m) => m.id === massageId) || null;
  }

  function getSessionSteps(item) {
    if (!item) return [];
    if (item.type === "bundle") {
      return Array.isArray(item.steps)
        ? item.steps.map((step) => ({
            name: String(step.name || ""),
            durationMin: Number(step.durationMin) || 0,
            bundleOnly: !!step.bundleOnly,
          }))
        : [];
    }
    return [{ name: item.name, durationMin: item.durationMin }];
  }

  MG.Data = {
    DISPLAY_NAME,
    MASSAGES,
    ROUTES,
    findMassageById,
    getSessionSteps,
  };
})();
