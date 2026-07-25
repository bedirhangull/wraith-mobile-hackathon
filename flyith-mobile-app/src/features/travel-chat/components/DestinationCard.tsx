import { Card, Typography } from "heroui-native";
import type { JSX } from "react";
import { Image, Pressable } from "react-native";

import type { DestinationOption } from "../types";
import { findLocalTripImage } from "../utils/localTripImages";
import { OPTION_CARD_WIDTH } from "./optionCardWidth";

export function DestinationCard({
  option,
  onPress,
}: {
  option: DestinationOption;
  onPress: (option: DestinationOption) => void;
}): JSX.Element {
  const localImage = !option.thumbnailUrl ? findLocalTripImage(option.name, option.id) : undefined;

  return (
    <Pressable style={{ width: OPTION_CARD_WIDTH }} onPress={() => onPress(option)}>
      <Card>
        {option.thumbnailUrl ? (
          <Image
            source={{ uri: option.thumbnailUrl }}
            className="h-32 w-full rounded-t-2xl"
            resizeMode="cover"
          />
        ) : localImage ? (
          <Image source={localImage} className="h-32 w-full rounded-t-2xl" resizeMode="cover" />
        ) : null}
        <Card.Body>
          <Card.Title>{option.name}</Card.Title>
          {option.countryOrRegion ? (
            <Card.Description>{option.countryOrRegion}</Card.Description>
          ) : null}
        </Card.Body>
        {option.estimatedPriceUSD ? (
          <Card.Footer>
            <Typography.Paragraph className="font-semibold text-accent">
              From ${option.estimatedPriceUSD}
            </Typography.Paragraph>
          </Card.Footer>
        ) : null}
      </Card>
    </Pressable>
  );
}
