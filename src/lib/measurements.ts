type MeasurementSystem = "metric" | "imperial";

function getSystem(): MeasurementSystem {
  const sys = import.meta.env.MEASUREMENT_SYSTEM || "metric";
  return sys === "imperial" ? "imperial" : "metric";
}

export const measurementSystem = getSystem();

const unitMap: Record<string, { metric: string; imperial: string; factor: number }> = {
  ml: { metric: "ml", imperial: "fl oz", factor: 0.033814 },
  l: { metric: "l", imperial: "qt", factor: 1.05669 },
  g: { metric: "g", imperial: "oz", factor: 0.035274 },
  kg: { metric: "kg", imperial: "lb", factor: 2.20462 },
  cm: { metric: "cm", imperial: "in", factor: 0.393701 },
};

export function convertUnit(amount: number, unit: string): { amount: number; unit: string } {
  const system = getSystem();
  const lowerUnit = unit.toLowerCase();

  if (system === "metric" || !(lowerUnit in unitMap)) {
    return { amount, unit };
  }

  const conversion = unitMap[lowerUnit];
  return {
    amount: Math.round(amount * conversion.factor * 100) / 100,
    unit: conversion.imperial,
  };
}

export function formatAmount(amount: number): string {
  if (amount === Math.floor(amount)) return String(amount);
  const rounded = Math.round(amount * 100) / 100;
  if (rounded === Math.floor(rounded)) return String(rounded);
  return rounded.toFixed(rounded < 10 ? 1 : 0);
}
