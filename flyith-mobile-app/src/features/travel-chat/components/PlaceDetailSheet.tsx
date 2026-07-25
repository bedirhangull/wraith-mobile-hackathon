import * as Haptics from "expo-haptics";
import { BottomSheet, Button, Skeleton, Tabs, Typography } from "heroui-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { type JSX, useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";

import { mapMapsPhotos, mapMapsReviews, mapPlaceDetails } from "../services/mappers";
import { getPlaceDetails, getPlacePhotos, getPlaceReviews } from "../services/serpapi";
import type { PhotoSection, PlaceDetail, PlaceOption, ReviewItem } from "../types";
import { formatReviewCount } from "../utils/formatReviewCount";
import { PhotoGallery } from "./PhotoGallery";
import { ReviewList } from "./ReviewList";

type Locale = "tr" | "en";

interface PlaceDetailSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  place: PlaceOption | null;
  onConfirmSelection: (place: PlaceOption) => void;
  locale?: Locale;
  onContextNote?: (text: string) => void;
}

function buildPlaceContextNote(
  place: PlaceOption,
  detail: PlaceDetail | null,
  reviews: ReviewItem[] | null,
  locale: Locale
): string {
  const tr = locale === "tr";
  const rating = detail?.rating ?? place.rating;
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
    ? `Kullanıcı ${place.name} yerini inceledi — ${ratingPart}. ${reviewPart}`
    : `User viewed place ${place.name} — ${ratingPart}. ${reviewPart}`;
}

function PlaceDetailBody({
  place,
  onConfirm,
  locale,
  onContextNote,
}: {
  place: PlaceOption;
  onConfirm: (place: PlaceOption) => void;
  locale: Locale;
  onContextNote?: (text: string) => void;
}): JSX.Element {
  const tr = locale === "tr";
  const [tab, setTab] = useState<"overview" | "photos" | "reviews">("overview");
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [detailFailed, setDetailFailed] = useState(false);
  const [sections, setSections] = useState<PhotoSection[] | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[] | null>(null);
  const notedRef = useRef(false);

  useEffect(() => {
    const query = [place.name, place.address].filter(Boolean).join(" ");
    getPlaceDetails(query)
      .then((response) => {
        const mapped = mapPlaceDetails(response);
        setDetail(mapped);
        if (!mapped?.dataId) return;
        getPlacePhotos(mapped.dataId)
          .then((photosResponse) =>
            setSections([
              {
                title: tr ? "Fotoğraflar" : "Photos",
                photos: mapMapsPhotos(photosResponse),
              },
            ])
          )
          .catch(() => setSections([]));
        getPlaceReviews(mapped.dataId)
          .then((reviewsResponse) => setReviews(mapMapsReviews(reviewsResponse)))
          .catch(() => setReviews([]));
      })
      .catch(() => setDetailFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (notedRef.current || !onContextNote) return;
    if (detail === null && reviews === null) return;
    if (detail === null && !detailFailed) return;
    notedRef.current = true;
    onContextNote(buildPlaceContextNote(place, detail, reviews, locale));
  }, [detail, detailFailed, reviews, onContextNote, place, locale]);

  return (
    <>
      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="mt-2">
        <Tabs.List>
          <Tabs.Indicator />
          <Tabs.Trigger value="overview">
            <Tabs.Label>{tr ? "Genel" : "Overview"}</Tabs.Label>
          </Tabs.Trigger>
          <Tabs.Trigger value="photos">
            <Tabs.Label>{tr ? "Fotoğraflar" : "Photos"}</Tabs.Label>
          </Tabs.Trigger>
          <Tabs.Trigger value="reviews">
            <Tabs.Label>{tr ? "Yorumlar" : "Reviews"}</Tabs.Label>
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 24, paddingTop: 12, gap: 12 }}>
        {tab === "overview" ? (
          detailFailed ? (
            <Typography.Paragraph className="px-4 text-muted">
              {tr ? "Detaylar yüklenemedi." : "Couldn't load details."}
            </Typography.Paragraph>
          ) : detail === null ? (
            <Skeleton className="mx-4 h-24 w-full rounded-xl" />
          ) : (
            <View className="gap-2 px-4">
              {detail.rating ? (
                <Typography.Paragraph className="text-foreground">
                  ★ {detail.rating}{" "}
                  {detail.reviewCount
                    ? tr
                      ? `(${formatReviewCount(detail.reviewCount, locale)} yorum)`
                      : `(${formatReviewCount(detail.reviewCount, locale)} reviews)`
                    : ""}
                </Typography.Paragraph>
              ) : null}
              {detail.address ? (
                <Typography.Paragraph className="text-muted">{detail.address}</Typography.Paragraph>
              ) : null}
              {detail.phone ? (
                <Typography.Paragraph className="text-muted">{detail.phone}</Typography.Paragraph>
              ) : null}
              {detail.todayHours ? (
                <Typography.Paragraph className="text-muted">
                  {tr ? `Bugün: ${detail.todayHours}` : `Today: ${detail.todayHours}`}
                </Typography.Paragraph>
              ) : null}
              <Button
                variant="secondary"
                onPress={() => void Linking.openURL(detail.mapsUrl)}
                className="mt-2"
              >
                {tr ? "Google Haritalar'da aç" : "Open in Google Maps"}
              </Button>
            </View>
          )
        ) : tab === "photos" ? (
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

      <View className="pt-2">
        <Button onPress={() => onConfirm(place)} animation={{ scale: { value: 0.94 } }}>
          {tr ? "Buraya gideceğim" : "I'll go here"}
        </Button>
      </View>
    </>
  );
}

export function PlaceDetailSheet({
  isOpen,
  onOpenChange,
  place,
  onConfirmSelection,
  locale = "en",
  onContextNote,
}: PlaceDetailSheetProps): JSX.Element {
  const tr = locale === "tr";
  const handleConfirm = (confirmedPlace: PlaceOption) => {
    void Haptics.selectionAsync();
    onConfirmSelection(confirmedPlace);
    onOpenChange(false);
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={["65%", "94%"]}
          enableDynamicSizing={false}
          contentContainerClassName="h-full"
        >
          <BottomSheet.Close />
          <BottomSheet.Title numberOfLines={1}>
            {place?.name ?? (tr ? "Yer" : "Place")}
          </BottomSheet.Title>
          {place?.category ? (
            <BottomSheet.Description>{place.category}</BottomSheet.Description>
          ) : null}

          {place ? (
            <PlaceDetailBody
              key={place.id}
              place={place}
              onConfirm={handleConfirm}
              locale={locale}
              onContextNote={onContextNote}
            />
          ) : null}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
