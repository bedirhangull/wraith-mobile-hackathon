import { BottomSheet, Skeleton, Tabs } from "heroui-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { type JSX, useEffect, useRef, useState } from "react";

import { mapHotelPhotoSections, mapHotelReviews } from "../services/mappers";
import { getHotelPhotos, getHotelReviews } from "../services/serpapi";
import type { PhotoSection, HotelOption, ReviewItem } from "../types";
import { PhotoGallery } from "./PhotoGallery";
import { ReviewList } from "./ReviewList";

type Locale = "tr" | "en";

interface HotelDetailSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  hotel: HotelOption | null;
  locale?: Locale;
  onContextNote?: (text: string) => void;
}

function buildHotelContextNote(
  hotel: HotelOption,
  reviews: ReviewItem[] | null,
  locale: Locale
): string {
  const tr = locale === "tr";
  const rating = hotel.rating;
  const snippets = (reviews ?? [])
    .slice(0, 3)
    .map((review) => review.snippet?.trim())
    .filter((snippet): snippet is string => Boolean(snippet))
    .map((snippet) => (snippet.length > 120 ? `${snippet.slice(0, 117)}…` : snippet));
  const ratingPart =
    rating != null ? (tr ? `${rating} puan` : `${rating} rating`) : tr ? "puan yok" : "no rating";
  const reviewPart =
    snippets.length > 0
      ? tr
        ? `Öne çıkan yorumlar: ${snippets.join(" / ")}`
        : `Top reviews: ${snippets.join(" / ")}`
      : tr
        ? "Yorum özeti yok"
        : "No review snippets";
  return tr
    ? `Kullanıcı ${hotel.name} otelini inceledi — ${ratingPart}. ${reviewPart}`
    : `User viewed hotel ${hotel.name} — ${ratingPart}. ${reviewPart}`;
}

function HotelDetailBody({
  hotel,
  propertyToken,
  locale,
  onContextNote,
}: {
  hotel: HotelOption;
  propertyToken: string;
  locale: Locale;
  onContextNote?: (text: string) => void;
}): JSX.Element {
  const tr = locale === "tr";
  const [tab, setTab] = useState<"photos" | "reviews">("photos");
  const [sections, setSections] = useState<PhotoSection[] | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[] | null>(null);
  const notedRef = useRef(false);

  useEffect(() => {
    getHotelPhotos(propertyToken)
      .then((response) => setSections(mapHotelPhotoSections(response)))
      .catch(() => setSections([]));
    getHotelReviews(propertyToken)
      .then((response) => setReviews(mapHotelReviews(response)))
      .catch(() => setReviews([]));
  }, [propertyToken]);

  useEffect(() => {
    if (notedRef.current || !onContextNote || reviews === null) return;
    notedRef.current = true;
    onContextNote(buildHotelContextNote(hotel, reviews, locale));
  }, [reviews, onContextNote, hotel, locale]);

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as "photos" | "reviews")}
        className="mt-2"
      >
        <Tabs.List>
          <Tabs.Indicator />
          <Tabs.Trigger value="photos">
            <Tabs.Label>{tr ? "Fotoğraflar" : "Photos"}</Tabs.Label>
          </Tabs.Trigger>
          <Tabs.Trigger value="reviews">
            <Tabs.Label>{tr ? "Yorumlar" : "Reviews"}</Tabs.Label>
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 24, paddingTop: 12, gap: 12 }}>
        {tab === "photos" ? (
          sections === null ? (
            <Skeleton className="mx-4 h-28 w-28 rounded-xl" />
          ) : (
            <PhotoGallery sections={sections} />
          )
        ) : reviews === null ? (
          <Skeleton className="mx-4 h-20 w-full rounded-xl" />
        ) : (
          <ReviewList reviews={reviews} locale={locale} />
        )}
      </BottomSheetScrollView>
    </>
  );
}

export function HotelDetailSheet({
  isOpen,
  onOpenChange,
  hotel,
  locale = "en",
  onContextNote,
}: HotelDetailSheetProps): JSX.Element {
  const tr = locale === "tr";
  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={["70%", "94%"]}
          enableDynamicSizing={false}
          contentContainerClassName="h-full"
        >
          <BottomSheet.Close />
          <BottomSheet.Title numberOfLines={1}>
            {hotel?.name ?? (tr ? "Otel" : "Hotel")}
          </BottomSheet.Title>

          {hotel?.propertyToken ? (
            <HotelDetailBody
              key={hotel.propertyToken}
              hotel={hotel}
              propertyToken={hotel.propertyToken}
              locale={locale}
              onContextNote={onContextNote}
            />
          ) : null}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
