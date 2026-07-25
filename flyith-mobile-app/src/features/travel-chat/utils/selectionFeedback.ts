import type { DayPlanSlotId } from "../types";

type Locale = "tr" | "en";

export function flightSelectedToast(locale: Locale): { label: string; descriptionHint?: string } {
  return {
    label: locale === "tr" ? "Uçuşun seçildi" : "Flight selected",
  };
}

export function hotelSelectedToast(locale: Locale): { label: string } {
  return {
    label: locale === "tr" ? "Otelin seçildi" : "Stay selected",
  };
}

export function placeSelectedToast(locale: Locale): { label: string } {
  return {
    label: locale === "tr" ? "Mekan seçildi" : "Place selected",
  };
}

export function slotToastLabel(slotId: DayPlanSlotId, locale: Locale): string {
  if (locale === "tr") {
    switch (slotId) {
      case "morning":
        return "Sabah planına eklendi";
      case "afternoon":
        return "Öğle planına eklendi";
      case "evening":
        return "Akşam planına eklendi";
    }
  }
  switch (slotId) {
    case "morning":
      return "Added to morning";
    case "afternoon":
      return "Added to afternoon";
    case "evening":
      return "Added to evening";
  }
}

export function changeActionLabel(locale: Locale): string {
  return locale === "tr" ? "Değiştir" : "Change";
}

export function planPrepareFailedToast(locale: Locale): { label: string; description: string } {
  return locale === "tr"
    ? {
        label: "Plan hazırlanamadı",
        description: "Biraz sonra tekrar dene.",
      }
    : {
        label: "Couldn't build the plan",
        description: "Try again in a moment.",
      };
}
