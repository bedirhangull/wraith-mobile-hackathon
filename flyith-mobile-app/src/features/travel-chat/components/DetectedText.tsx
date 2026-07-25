import { type JSX, useMemo } from "react";
import { Linking, Text } from "react-native";

import {
  type DetectedEntity,
  detectJs,
  getNativeDataDetector,
  isNativeDataDetectorAvailable,
} from "../utils/safeDataDetector";

type Locale = "tr" | "en";

interface DetectedTextProps {
  text: string;
  locale?: Locale;
  className?: string;
  /** Style for tappable entity spans (phone, URL, email, address). */
  linkClassName?: string;
}

interface TextSegment {
  key: string;
  value: string;
  entity?: DetectedEntity;
}

function buildSegments(text: string, entities: DetectedEntity[]): TextSegment[] {
  if (entities.length === 0) {
    return [{ key: "full", value: text }];
  }

  const sorted = [...entities].sort((a, b) => a.start - b.start);
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const entity of sorted) {
    if (entity.start < cursor || entity.end <= entity.start) continue;
    if (entity.start > cursor) {
      segments.push({
        key: `t-${cursor}`,
        value: text.slice(cursor, entity.start),
      });
    }
    segments.push({
      key: `e-${entity.start}-${entity.type}`,
      value: text.slice(entity.start, entity.end),
      entity,
    });
    cursor = entity.end;
  }

  if (cursor < text.length) {
    segments.push({ key: `t-${cursor}`, value: text.slice(cursor) });
  }

  return segments;
}

async function openEntity(entity: DetectedEntity): Promise<void> {
  try {
    switch (entity.type) {
      case "phoneNumber": {
        const phone = entity.data?.phoneNumber ?? entity.text;
        await Linking.openURL(`tel:${phone}`);
        break;
      }
      case "email": {
        const email = entity.data?.email ?? entity.text;
        await Linking.openURL(`mailto:${email}`);
        break;
      }
      case "link": {
        const url = entity.data?.url ?? entity.text;
        await Linking.openURL(url.startsWith("http") ? url : `https://${url}`);
        break;
      }
      case "address": {
        const parts = [
          entity.data?.street,
          entity.data?.city,
          entity.data?.state,
          entity.data?.zip,
          entity.data?.country,
        ]
          .filter(Boolean)
          .join(", ");
        const address = entity.data?.address || parts || entity.text;
        await Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(address)}`);
        break;
      }
      case "date":
        break;
    }
  } catch {
    // Ignore Linking failures (unsupported schemes / cancelled).
  }
}

function DetectedTextView({
  text,
  entities,
  className,
  linkClassName,
}: {
  text: string;
  entities: DetectedEntity[];
  className?: string;
  linkClassName: string;
}): JSX.Element {
  const segments = useMemo(() => buildSegments(text, entities), [text, entities]);

  return (
    <Text className={className}>
      {segments.map((segment) =>
        segment.entity && segment.entity.type !== "date" ? (
          <Text
            key={segment.key}
            className={linkClassName}
            onPress={() => {
              void openEntity(segment.entity!);
            }}
          >
            {segment.value}
          </Text>
        ) : segment.entity?.type === "date" ? (
          <Text key={segment.key} className={linkClassName}>
            {segment.value}
          </Text>
        ) : (
          <Text key={segment.key}>{segment.value}</Text>
        )
      )}
    </Text>
  );
}

function NativeDetectedText({
  text,
  locale,
  className,
  linkClassName,
}: {
  text: string;
  locale: Locale;
  className?: string;
  linkClassName: string;
}): JSX.Element {
  const native = getNativeDataDetector()!;
  const { entities } = native.useDetectedEntities(text, {
    language: locale,
    debounceMs: 120,
    types: ["phoneNumber", "link", "email", "address", "date"],
  });
  return (
    <DetectedTextView
      text={text}
      entities={entities}
      className={className}
      linkClassName={linkClassName}
    />
  );
}

function FallbackDetectedText({
  text,
  className,
  linkClassName,
}: {
  text: string;
  className?: string;
  linkClassName: string;
}): JSX.Element {
  const entities = useMemo(() => detectJs(text), [text]);
  return (
    <DetectedTextView
      text={text}
      entities={entities}
      className={className}
      linkClassName={linkClassName}
    />
  );
}

/** Renders chat text with tappable phone / URL / email / address / date spans. */
export function DetectedText({
  text,
  locale = "en",
  className,
  linkClassName = "text-accent underline",
}: DetectedTextProps): JSX.Element {
  if (isNativeDataDetectorAvailable) {
    return (
      <NativeDetectedText
        text={text}
        locale={locale}
        className={className}
        linkClassName={linkClassName}
      />
    );
  }
  return <FallbackDetectedText text={text} className={className} linkClassName={linkClassName} />;
}
