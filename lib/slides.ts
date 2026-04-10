import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "@/lib/supabase";
import type { SlideFile } from "@/types/models";

const OFFLINE_SLIDE_MAP_KEY = "upsa.offlineSlides";

type OfflineSlideMap = Record<string, string>;

async function getOfflineSlideMap(): Promise<OfflineSlideMap> {
  const value = await AsyncStorage.getItem(OFFLINE_SLIDE_MAP_KEY);
  if (!value) return {};
  return JSON.parse(value) as OfflineSlideMap;
}

async function setOfflineSlideMap(map: OfflineSlideMap) {
  await AsyncStorage.setItem(OFFLINE_SLIDE_MAP_KEY, JSON.stringify(map));
}

export async function fetchSlides() {
  const { data, error } = await supabase.storage.from("slides").list("", {
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    throw new Error(error.message);
  }

  const offlineMap = await getOfflineSlideMap();

  return (data ?? [])
    .filter((file) => file.name.toLowerCase().endsWith(".pdf"))
    .map<SlideFile>((file) => ({
      id: file.id ?? file.name,
      name: file.name,
      path: file.name,
      updatedAt: file.updated_at ?? undefined,
      localPath: offlineMap[file.name],
    }));
}

export async function openSlide(slidePath: string) {
  const map = await getOfflineSlideMap();
  const localUri = map[slidePath];

  if (localUri) {
    await WebBrowser.openBrowserAsync(localUri);
    return;
  }

  const { data } = supabase.storage.from("slides").getPublicUrl(slidePath);
  await WebBrowser.openBrowserAsync(data.publicUrl);
}

export async function downloadSlideForOffline(slide: SlideFile) {
  const { data } = supabase.storage.from("slides").getPublicUrl(slide.path);

  const filename = `${Date.now()}-${slide.name}`;
  const destination = `${FileSystem.documentDirectory}${filename}`;

  const downloaded = await FileSystem.downloadAsync(
    data.publicUrl,
    destination,
  );

  const map = await getOfflineSlideMap();
  map[slide.path] = downloaded.uri;
  await setOfflineSlideMap(map);

  return downloaded.uri;
}

export async function getSlideExtractText(slidePath: string) {
  const { data, error } = await supabase.functions.invoke(
    "extract-slide-text",
    {
      body: { path: slidePath },
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (typeof data === "object" && data && "text" in data) {
    return String((data as { text: string }).text);
  }

  return typeof data === "string" ? data : "";
}
