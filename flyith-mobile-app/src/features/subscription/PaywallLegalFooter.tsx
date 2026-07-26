import type { JSX } from "react";
import { Linking, Pressable, View } from "react-native";
import { Typography } from "heroui-native";

import { LEGAL_URLS } from "./constants";

interface PaywallLegalFooterProps {
  isBusy?: boolean;
  onRestore: () => void;
}

export function PaywallLegalFooter({ isBusy = false, onRestore }: PaywallLegalFooterProps): JSX.Element {
  return (
    <View className="items-center gap-2">
      <Pressable accessibilityRole="button" disabled={isBusy} onPress={onRestore}>
        <Typography color="muted" type="body-sm" weight="medium">
          Restore Purchases
        </Typography>
      </Pressable>
      <View className="flex-row items-center gap-2">
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(LEGAL_URLS.terms)}>
          <Typography color="muted" type="body-xs">
            Terms
          </Typography>
        </Pressable>
        <Typography color="muted" type="body-xs">
          ·
        </Typography>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(LEGAL_URLS.privacy)}>
          <Typography color="muted" type="body-xs">
            Privacy Policy
          </Typography>
        </Pressable>
      </View>
    </View>
  );
}
