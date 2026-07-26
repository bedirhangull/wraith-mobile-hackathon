import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Avatar,
  Button,
  Dialog,
  ListGroup,
  Separator,
  Surface,
  Typography,
  useThemeColor,
  useToast,
} from "heroui-native";
import type { ComponentProps, JSX } from "react";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "@/components/back-button";
import { signOut } from "@/features/auth/api";
import { fetchProfile } from "@/features/auth/profile-api";
import { useSession } from "@/features/auth/session";
import { resetUserProfile } from "@/features/onboarding/profile";
import { usePremium } from "@/features/subscription/usePremium";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

interface SettingsRowProps {
  description?: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  isDanger?: boolean;
  onPress?: () => void;
  title: string;
}

function SettingsRow({
  description,
  icon,
  isDanger = false,
  onPress,
  title,
}: SettingsRowProps): JSX.Element {
  const [accentColor, dangerColor] = useThemeColor(["accent", "danger"]);

  return (
    <ListGroup.Item accessibilityRole="button" onPress={onPress}>
      <ListGroup.ItemPrefix>
        <Ionicons color={isDanger ? dangerColor : accentColor} name={icon} size={22} />
      </ListGroup.ItemPrefix>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle className={isDanger ? "text-danger" : undefined}>
          {title}
        </ListGroup.ItemTitle>
        {description ? <ListGroup.ItemDescription>{description}</ListGroup.ItemDescription> : null}
      </ListGroup.ItemContent>
      {isDanger ? null : <ListGroup.ItemSuffix />}
    </ListGroup.Item>
  );
}

export default function ProfileScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const accentColor = useThemeColor("accent");
  const { toast } = useToast();
  const session = useSession();
  const {
    deactivateMockPremium,
    isMockMode,
    isPremium,
    isPurchasing,
  } = usePremium();
  const [isCancelSubscriptionDialogOpen, setIsCancelSubscriptionDialogOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetchProfile(session.user.id).then((profile) => {
      if (profile) {
        setFullName(profile.fullName);
      }
    });
  }, [session]);

  const emailFallback = session?.user.email?.split("@")[0] ?? "Traveler";
  const displayName = fullName?.trim() || emailFallback;

  async function handleLogout(): Promise<void> {
    setIsLoggingOut(true);
    try {
      await signOut();
      resetUserProfile();
      setIsLogoutDialogOpen(false);
      router.replace("/welcome");
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn't log out",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function handleCancelMockSubscription(): Promise<void> {
    const result = await deactivateMockPremium();
    if (result === "success") {
      setIsCancelSubscriptionDialogOpen(false);
      toast.show({
        variant: "success",
        label: "Subscription cancelled",
        description: "You can subscribe again from any Premium paywall.",
      });
      return;
    }

    toast.show({
      variant: "danger",
      label: "Couldn't cancel subscription",
      description: "Please try again.",
    });
  }

  function handlePlanPress(): void {
    if (isMockMode && isPremium) {
      setIsCancelSubscriptionDialogOpen(true);
      return;
    }
    router.push("/paywall-2");
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        contentContainerClassName="gap-7 px-5 pb-10"
        contentContainerStyle={{ paddingTop: insets.top + 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between">
          <BackButton onPress={() => router.back()} />
          <Button onPress={handlePlanPress} size="sm" variant="secondary">
            {isPremium ? "Pro Plan" : "Free Plan"}
          </Button>
        </View>

        <View className="items-center gap-3">
          <Pressable accessibilityLabel="Change profile photo" accessibilityRole="button">
            <Avatar color="accent" size="lg" variant="soft">
              <Avatar.Fallback>{getInitials(displayName)}</Avatar.Fallback>
            </Avatar>
            <Surface
              className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full p-0"
              variant="default"
            >
              <Ionicons color={accentColor} name="camera" size={15} />
            </Surface>
          </Pressable>

          <View className="items-center gap-1">
            <Typography type="h3">{displayName}</Typography>
            <Typography color="muted" type="body-sm">
              Personal travel profile
            </Typography>
          </View>
        </View>

        <View className="gap-2">
          <Typography className="px-1" color="muted" type="body-xs">
            MY TRAVEL
          </Typography>
          <ListGroup>
            <SettingsRow
              description="Your previous travel plans"
              icon="map-outline"
              onPress={() => router.push("/past-trips")}
              title="Past Trips"
            />
          </ListGroup>
        </View>

        <View className="gap-2">
          <Typography className="px-1" color="muted" type="body-xs">
            SETTINGS
          </Typography>
          <ListGroup>
            <SettingsRow
              description="Alerts, reminders, and updates"
              icon="notifications-outline"
              title="Notifications"
            />
            <Separator className="mx-4" />
            <SettingsRow
              description="Name, photo, and contact details"
              icon="person-outline"
              title="Update Information"
            />
            <Separator className="mx-4" />
            <SettingsRow
              description="Update your account password"
              icon="lock-closed-outline"
              title="Change Password"
            />
          </ListGroup>
        </View>

        <ListGroup>
          <SettingsRow
            icon="log-out-outline"
            isDanger
            onPress={() => setIsLogoutDialogOpen(true)}
            title="Log Out"
          />
        </ListGroup>
      </ScrollView>

      <Dialog
        isOpen={isCancelSubscriptionDialogOpen}
        onOpenChange={setIsCancelSubscriptionDialogOpen}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="items-center" isSwipeable={false}>
            <View className="mb-10 w-full items-center gap-2">
              <Dialog.Title className="text-center">Cancel your Premium plan?</Dialog.Title>
              <Typography className="text-center" color="muted" type="body-sm">
                Premium chat, YouTube, and influencer features will be locked again.
              </Typography>
            </View>
            <View className="w-full flex-row justify-center gap-3">
              <Button
                className="flex-1"
                isDisabled={isPurchasing}
                onPress={() => setIsCancelSubscriptionDialogOpen(false)}
                variant="secondary"
              >
                Keep Premium
              </Button>
              <Button
                className="flex-1"
                isDisabled={isPurchasing}
                onPress={() => void handleCancelMockSubscription()}
                variant="danger"
              >
                {isPurchasing ? "Cancelling…" : "Cancel Plan"}
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      <Dialog isOpen={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="items-center" isSwipeable={false}>
            <View className="mb-10 w-full items-center">
              <Dialog.Title className="text-center">Are you sure you want to log out?</Dialog.Title>
            </View>
            <View className="w-full flex-row justify-center gap-3">
              <Button
                className="flex-1"
                onPress={() => setIsLogoutDialogOpen(false)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                isDisabled={isLoggingOut}
                onPress={handleLogout}
                variant="danger"
              >
                {isLoggingOut ? "Logging out…" : "Log Out"}
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}
