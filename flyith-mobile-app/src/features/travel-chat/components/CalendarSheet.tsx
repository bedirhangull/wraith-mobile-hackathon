import { BottomSheet, Button, Typography, useThemeColor } from "heroui-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { type JSX, useState } from "react";
import { Pressable, View } from "react-native";

import { addDays, formatShortDate, nightsBetween, toIsoDate } from "../utils/dates";

interface CalendarSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  locale: "tr" | "en";
  initialStartDate?: string;
  onConfirm: (startDate: string, endDate: string) => void;
}

const WEEKDAY_LABELS = {
  tr: ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"],
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
} as const;

const COPY = {
  tr: {
    title: "Tarihleri seç",
    pickStart: "Gidiş tarihini seç",
    pickEnd: "Dönüş tarihini seç",
    confirm: "Onayla",
    nights: (count: number) => `${count} gece`,
  },
  en: {
    title: "Pick your dates",
    pickStart: "Choose your departure date",
    pickEnd: "Choose your return date",
    confirm: "Confirm",
    nights: (count: number) => `${count} nights`,
  },
} as const;

/** Monday-first offset for a month's 1st. */
function leadingBlanks(year: number, monthIndex: number): number {
  const jsWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay(); // 0 = Sunday
  return (jsWeekday + 6) % 7;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function CalendarBody({
  locale,
  initialStartDate,
  onConfirm,
  onOpenChange,
}: Omit<CalendarSheetProps, "isOpen">): JSX.Element {
  const today = toIsoDate(new Date());
  const anchor = initialStartDate && initialStartDate >= today ? initialStartDate : today;

  const [cursor, setCursor] = useState(() => ({
    year: Number(anchor.slice(0, 4)),
    monthIndex: Number(anchor.slice(5, 7)) - 1,
  }));
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const [accentColor, mutedColor, foregroundColor] = useThemeColor([
    "accent",
    "muted",
    "foreground",
  ]);
  const copy = COPY[locale];

  const monthLabel = new Date(Date.UTC(cursor.year, cursor.monthIndex, 1)).toLocaleDateString(
    locale === "tr" ? "tr-TR" : "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" }
  );

  const totalDays = daysInMonth(cursor.year, cursor.monthIndex);
  const blanks = leadingBlanks(cursor.year, cursor.monthIndex);
  const cells: (string | null)[] = [
    ...Array.from({ length: blanks }, () => null),
    ...Array.from({ length: totalDays }, (_, index) =>
      toIsoDate(new Date(Date.UTC(cursor.year, cursor.monthIndex, index + 1)))
    ),
  ];

  const shiftMonth = (delta: number) => {
    setCursor((current) => {
      const next = new Date(Date.UTC(current.year, current.monthIndex + delta, 1));
      return { year: next.getUTCFullYear(), monthIndex: next.getUTCMonth() };
    });
  };

  const handleDayPress = (date: string) => {
    if (startDate === null || endDate !== null) {
      setStartDate(date);
      setEndDate(null);
      return;
    }
    if (date <= startDate) {
      setStartDate(date);
      return;
    }
    setEndDate(date);
  };

  const canGoBack =
    `${cursor.year}-${String(cursor.monthIndex + 1).padStart(2, "0")}` > today.slice(0, 7);
  const nights = startDate && endDate ? nightsBetween(startDate, endDate) : 0;

  return (
    <View className="gap-4 pb-6 pt-2">
      <View className="flex-row items-center justify-between px-1">
        <Pressable
          disabled={!canGoBack}
          onPress={() => shiftMonth(-1)}
          className="size-10 items-center justify-center rounded-full"
          style={{ opacity: canGoBack ? 1 : 0.3 }}
        >
          <ChevronLeft size={20} color={foregroundColor} />
        </Pressable>
        <Typography.Paragraph className="text-base font-semibold text-foreground">
          {monthLabel}
        </Typography.Paragraph>
        <Pressable
          onPress={() => shiftMonth(1)}
          className="size-10 items-center justify-center rounded-full"
        >
          <ChevronRight size={20} color={foregroundColor} />
        </Pressable>
      </View>

      <View className="flex-row">
        {WEEKDAY_LABELS[locale].map((day) => (
          <View key={day} className="flex-1 items-center">
            <Typography.Paragraph className="text-xs text-muted">{day}</Typography.Paragraph>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map((date, index) => {
          if (date === null) {
            return (
              <View key={`blank-${index}`} style={{ width: `${100 / 7}%` }} className="h-11" />
            );
          }

          const isPast = date < today;
          const isStart = date === startDate;
          const isEnd = date === endDate;
          const inRange =
            startDate !== null && endDate !== null && date > startDate && date < endDate;
          const isEdge = isStart || isEnd;

          return (
            <View
              key={date}
              style={{ width: `${100 / 7}%` }}
              className="h-11 items-center justify-center"
            >
              <Pressable
                disabled={isPast}
                onPress={() => handleDayPress(date)}
                className="size-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor: isEdge
                    ? accentColor
                    : inRange
                      ? `${accentColor}26`
                      : "transparent",
                  opacity: isPast ? 0.25 : 1,
                }}
              >
                <Typography.Paragraph
                  className="text-sm"
                  style={{ color: isEdge ? "#ffffff" : isPast ? mutedColor : foregroundColor }}
                >
                  {Number(date.slice(8, 10))}
                </Typography.Paragraph>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Typography.Paragraph className="text-center text-sm text-muted">
        {startDate === null
          ? copy.pickStart
          : endDate === null
            ? copy.pickEnd
            : `${formatShortDate(startDate)} – ${formatShortDate(endDate)} · ${copy.nights(nights)}`}
      </Typography.Paragraph>

      <Button
        isDisabled={startDate === null || endDate === null}
        onPress={() => {
          if (startDate === null) return;
          // A single-day tap still needs a return date to price a round trip.
          const resolvedEnd = endDate ?? addDays(startDate, 1);
          onOpenChange(false);
          onConfirm(startDate, resolvedEnd);
        }}
      >
        {copy.confirm}
      </Button>
    </View>
  );
}

export function CalendarSheet({
  isOpen,
  onOpenChange,
  locale,
  initialStartDate,
  onConfirm,
}: CalendarSheetProps): JSX.Element {
  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <BottomSheet.Close />
          <BottomSheet.Title>{COPY[locale].title}</BottomSheet.Title>
          {/* Keyed so every open starts from a clean selection. */}
          {isOpen ? (
            <CalendarBody
              key={initialStartDate ?? "today"}
              locale={locale}
              initialStartDate={initialStartDate}
              onConfirm={onConfirm}
              onOpenChange={onOpenChange}
            />
          ) : null}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
