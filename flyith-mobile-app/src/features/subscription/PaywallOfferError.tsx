import type { JSX } from "react";
import { View } from "react-native";
import { Button, Surface, Typography } from "heroui-native";

interface PaywallOfferErrorProps {
  message: string;
  isBusy?: boolean;
  onRetry: () => void;
}

export function PaywallOfferError({
  message,
  isBusy = false,
  onRetry,
}: PaywallOfferErrorProps): JSX.Element {
  return (
    <Surface className="gap-3 rounded-2xl border border-border px-4 py-4" variant="secondary">
      <View className="gap-1">
        <Typography weight="semibold">Subscriptions unavailable</Typography>
        <Typography color="muted" type="body-sm">
          {message}
        </Typography>
      </View>
      <Button isDisabled={isBusy} onPress={onRetry} size="sm" variant="secondary">
        <Button.Label>{isBusy ? "Retrying…" : "Try again"}</Button.Label>
      </Button>
    </Surface>
  );
}
