import { Typography } from "heroui-native";
import { type JSX, useState } from "react";
import { Image, Modal, Pressable, ScrollView, View } from "react-native";

import type { PhotoItem, PhotoSection } from "../types";

export function PhotoGallery({ sections }: { sections: PhotoSection[] }): JSX.Element {
  const [viewerPhoto, setViewerPhoto] = useState<PhotoItem | null>(null);

  return (
    <View className="gap-4">
      {sections.map((section) => (
        <View key={section.title} className="gap-2">
          <Typography.Paragraph className="px-4 font-semibold text-foreground">
            {section.title}
          </Typography.Paragraph>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 px-4"
          >
            {section.photos.map((photo) => (
              <Pressable key={photo.id} onPress={() => setViewerPhoto(photo)}>
                <Image
                  source={{ uri: photo.thumbnailUrl }}
                  className="h-28 w-28 rounded-xl"
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ))}

      <Modal
        visible={viewerPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerPhoto(null)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/90"
          onPress={() => setViewerPhoto(null)}
        >
          {viewerPhoto ? (
            <Image
              source={{ uri: viewerPhoto.fullUrl }}
              className="h-4/5 w-full"
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
