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
} from "heroui-native";
import type { ComponentProps, JSX } from "react";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        contentContainerClassName="gap-7 px-5 pb-10"
        contentContainerStyle={{ paddingTop: insets.top + 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Typography type="h1">Profile</Typography>

        <View className="items-center gap-3">
          <Pressable accessibilityLabel="Change profile photo" accessibilityRole="button">
            <Avatar color="accent" size="lg" variant="soft">
              <Avatar.Fallback>ÖB</Avatar.Fallback>
            </Avatar>
            <Surface
              className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full p-0"
              variant="default"
            >
              <Ionicons color={accentColor} name="camera" size={15} />
            </Surface>
          </Pressable>

          <View className="items-center gap-1">
            <Typography type="h3">Öykü Bıçkıcı</Typography>
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
              description="Tickets and completed routes"
              icon="airplane-outline"
              title="Past Flights"
            />
            <Separator className="mx-4" />
            <SettingsRow
              description="Your previous travel plans"
              icon="map-outline"
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

        <View className="gap-3">
          <Typography className="px-1" color="muted" type="body-xs">
            PAYWALL TESTS
          </Typography>
          <Button onPress={() => router.push("/paywall-2")} variant="secondary">
            Paywall 2
          </Button>
          <Button onPress={() => router.push("/paywall-3")} variant="secondary">
            Paywall 3
          </Button>
        </View>
      </ScrollView>

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
                onPress={() => router.replace("/welcome")}
                variant="danger"
              >
                Log Out
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}
