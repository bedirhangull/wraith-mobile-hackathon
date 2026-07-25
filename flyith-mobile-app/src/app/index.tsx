import { useRouter } from "expo-router";
import type { JSX } from "react";
import { useEffect } from "react";
import { Image, View } from "react-native";

const airplaneIcon = require("../../assets/images/airplane-memoji.png");

export default function SplashScreen(): JSX.Element {
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace("/welcome");
    }, 1500);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Image
        accessibilityLabel="Flyith airplane"
        className="h-44 w-44"
        resizeMode="contain"
        source={airplaneIcon}
      />
    </View>
  );
}
