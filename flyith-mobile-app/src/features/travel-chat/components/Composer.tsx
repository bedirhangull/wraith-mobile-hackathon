import { useThemeColor } from "heroui-native";
import { ArrowUp } from "lucide-react-native";
import { type JSX, useState } from "react";
import { Pressable, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, withSpring, withTiming } from "react-native-reanimated";

type Locale = "tr" | "en";

interface ComposerProps {
  onSend: (text: string) => void;
  isSending: boolean;
  locale?: Locale;
}

export function Composer({ onSend, isSending, locale = "en" }: ComposerProps): JSX.Element {
  const [text, setText] = useState("");
  const [contentHeight, setContentHeight] = useState(24);
  const insets = useSafeAreaInsets();
  const [mutedColor, accentColor, accentForegroundColor] = useThemeColor([
    "muted",
    "accent",
    "accent-foreground",
  ]);

  const canSend = !isSending && text.trim().length > 0;
  const placeholder = locale === "tr" ? "Nereye gidelim?" : "Where to?";

  const inputWrapperStyle = useAnimatedStyle(() => ({
    minHeight: withSpring(Math.min(Math.max(contentHeight + 22, 44), 130), {
      duration: 300,
      dampingRatio: 1,
    }),
    marginBottom: insets.bottom + 8,
  }));

  const sendButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(canSend ? 1 : 0.85, { duration: 250, dampingRatio: 0.8 }) }],
    opacity: withTiming(canSend ? (isSending ? 0.7 : 1) : 0.4, { duration: 150 }),
  }));

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    onSend(trimmed);
    setText("");
    setContentHeight(24);
  };

  return (
    <Animated.View
      style={inputWrapperStyle}
      className="mx-4 flex-row items-end gap-2 rounded-[28px] border border-field-border bg-field px-4 py-2"
    >
      <TextInput
        value={text}
        onChangeText={setText}
        editable={!isSending}
        onContentSizeChange={(event) => setContentHeight(event.nativeEvent.contentSize.height)}
        multiline
        placeholder={placeholder}
        placeholderTextColor={mutedColor}
        accessibilityState={{ disabled: isSending }}
        className="flex-1 py-2 text-base text-field-foreground"
        style={{ maxHeight: 130, opacity: isSending ? 0.55 : 1 }}
      />

      <Animated.View style={sendButtonStyle}>
        <Pressable
          onPress={handleSend}
          disabled={!canSend || isSending}
          accessibilityState={{ disabled: !canSend || isSending }}
          className="size-9 items-center justify-center rounded-full"
          style={{ backgroundColor: accentColor }}
        >
          <ArrowUp size={18} color={accentForegroundColor} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
