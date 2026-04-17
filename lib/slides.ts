import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";

import { supabase } from "@/lib/supabase";
import type { SlideFile } from "@/types/models";

const OFFLINE_SLIDE_MAP_KEY = "upsa.offlineSlides";
const LOCAL_SLIDES_KEY = "upsa.localSlides";
const SLIDE_FOLDERS_KEY = "upsa.slideFolders";
const SLIDES_DIR = `${FileSystem.documentDirectory}slides/`;
const SUPPORTED_SLIDE_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx"];

type OfflineSlideMap = Record<string, string>;

type StoredLocalSlide = {
  id: string;
  name: string;
  path: string;
  folderName?: string;
  courseCode?: string;
  localPath: string;
  updatedAt?: string;
};

function normalizeFolderName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isSupportedSlideName(name: string) {
  const lower = name.toLowerCase();
  return SUPPORTED_SLIDE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function ensureSlidesDirectory() {
  const info = await FileSystem.getInfoAsync(SLIDES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SLIDES_DIR, { intermediates: true });
  }
}

async function removeLocalFileIfExists(uri: string | undefined) {
  if (!uri) return;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // Ignore cleanup failures to avoid blocking storage map updates.
  }
}

async function getOfflineSlideMap(): Promise<OfflineSlideMap> {
  const value = await AsyncStorage.getItem(OFFLINE_SLIDE_MAP_KEY);
  if (!value) return {};
  return JSON.parse(value) as OfflineSlideMap;
}

async function setOfflineSlideMap(map: OfflineSlideMap) {
  await AsyncStorage.setItem(OFFLINE_SLIDE_MAP_KEY, JSON.stringify(map));
}

async function getStoredLocalSlides(): Promise<StoredLocalSlide[]> {
  const raw = await AsyncStorage.getItem(LOCAL_SLIDES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredLocalSlide[];
  } catch {
    return [];
  }
}

async function setStoredLocalSlides(slides: StoredLocalSlide[]) {
  await AsyncStorage.setItem(LOCAL_SLIDES_KEY, JSON.stringify(slides));
}

export async function fetchSlideFolders() {
  const raw = await AsyncStorage.getItem(SLIDE_FOLDERS_KEY);
  if (!raw) return ["GENERAL"];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ["GENERAL"];

    const cleaned = Array.from(
      new Set(parsed.map((item) => normalizeFolderName(String(item))).filter(Boolean)),
    );

    return cleaned.length ? cleaned : ["GENERAL"];
  } catch {
    return ["GENERAL"];
  }
}

export async function createSlideFolder(folderName: string) {
  const normalized = normalizeFolderName(folderName);
  if (!normalized) {
    throw new Error("Folder name cannot be empty.");
  }

  const folders = await fetchSlideFolders();
  if (folders.some((folder) => folder.toLowerCase() === normalized.toLowerCase())) {
    return folders;
  }

  const next = [...folders, normalized].sort((a, b) => a.localeCompare(b));
  await AsyncStorage.setItem(SLIDE_FOLDERS_KEY, JSON.stringify(next));
  return next;
}

export async function fetchSlides() {
  const { data, error } = await supabase.storage.from("slides").list("", {
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    throw new Error(error.message);
  }

  const offlineMap = await getOfflineSlideMap();
  const localSlides = await getStoredLocalSlides();

  const remoteSlides = (data ?? [])
    .filter((file) => isSupportedSlideName(file.name))
    .map<SlideFile>((file) => ({
      id: file.id ?? file.name,
      name: file.name,
      path: file.name,
      updatedAt: file.updated_at ?? undefined,
      localPath: offlineMap[file.name],
      source: "remote",
    }));

  const localSlideFiles = localSlides
    .filter((slide) => isSupportedSlideName(slide.name))
    .map<SlideFile>((slide) => ({
      id: slide.id,
      name: slide.name,
      path: slide.path,
      folderName: slide.folderName,
      courseCode: slide.courseCode,
      updatedAt: slide.updatedAt,
      localPath: slide.localPath,
      source: "local",
    }));

  return [...localSlideFiles, ...remoteSlides];
}

export async function addLocalSlide(params: {
  name: string;
  uri: string;
  folderName?: string;
  courseCode?: string;
}) {
  const { name, uri, folderName, courseCode } = params;
  await ensureSlidesDirectory();

  const localName = `${Date.now()}-${sanitizeFilename(name)}`;
  const localPath = `${SLIDES_DIR}${localName}`;
  await FileSystem.copyAsync({
    from: uri,
    to: localPath,
  });

  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `local://${id}`;
  const normalizedFolder = folderName ? normalizeFolderName(folderName) : undefined;
  const normalizedCourseCode = courseCode?.trim().toUpperCase();

  const localSlides = await getStoredLocalSlides();
  const nextSlide: StoredLocalSlide = {
    id,
    name,
    path,
    folderName: normalizedFolder || undefined,
    localPath,
    courseCode: normalizedCourseCode || undefined,
    updatedAt: new Date().toISOString(),
  };

  await setStoredLocalSlides([nextSlide, ...localSlides]);

  if (normalizedFolder) {
    await createSlideFolder(normalizedFolder);
  }

  const offlineMap = await getOfflineSlideMap();
  offlineMap[path] = localPath;
  await setOfflineSlideMap(offlineMap);

  return nextSlide;
}

async function resolveSlideLocalUri(slide: SlideFile) {
  const map = await getOfflineSlideMap();
  const mappedUri = map[slide.path] ?? slide.localPath;

  if (mappedUri) {
    return mappedUri;
  }

  if (slide.source === "local") {
    throw new Error("Local slide file is missing.");
  }

  await ensureSlidesDirectory();
  const { data } = supabase.storage.from("slides").getPublicUrl(slide.path);

  const filename = `${Date.now()}-${sanitizeFilename(slide.name)}`;
  const destination = `${SLIDES_DIR}${filename}`;
  const downloaded = await FileSystem.downloadAsync(data.publicUrl, destination);

  map[slide.path] = downloaded.uri;
  await setOfflineSlideMap(map);

  return downloaded.uri;
}

async function openLocalFileNatively(localUri: string) {
  try {
    const module = require("react-native-file-viewer") as {
      default?: {
        open: (path: string, options?: { showOpenWithDialog?: boolean }) => Promise<void>;
      };
      open: (path: string, options?: { showOpenWithDialog?: boolean }) => Promise<void>;
    };
    const fileViewer = module.default ?? module;

    if (typeof fileViewer.open !== "function") {
      throw new Error("react-native-file-viewer did not expose an open() method.");
    }

    await fileViewer.open(localUri, { showOpenWithDialog: true });
    return;
  } catch (nativeError) {
    try {
      const canOpen = await Linking.canOpenURL(localUri);
      if (canOpen) {
        await Linking.openURL(localUri);
        return;
      }
    } catch {
      // Fall through to throw with native error context.
    }

    const reason =
      nativeError instanceof Error && nativeError.message
        ? ` ${nativeError.message}`
        : "";
    throw new Error(
      `Unable to open this local file on device.${reason} Ensure a compatible app is installed for this file type.`,
    );
  }
}

export async function openSlideInApp(slide: SlideFile) {
  const localUri = await resolveSlideLocalUri(slide);

  try {
    await openLocalFileNatively(localUri);
    return;
  } catch {
    // Continue to browser fallbacks.
  }

  try {
    await WebBrowser.openBrowserAsync(localUri);
    return;
  } catch {
    // If local file URI cannot be previewed, fallback to cloud URL for published slides.
    if (slide.source !== "local") {
      const { data } = supabase.storage.from("slides").getPublicUrl(slide.path);
      await WebBrowser.openBrowserAsync(data.publicUrl);
      return;
    }

    throw new Error("Unable to open this file in-app.");
  }
}

export async function openSlide(slidePath: string) {
  const slides = await fetchSlides();
  const matched = slides.find((slide) => slide.path === slidePath);

  if (!matched) {
    throw new Error("Slide not found.");
  }

  await openSlideInApp(matched);
}

export async function downloadSlideForOffline(slide: SlideFile) {
  if (slide.source === "local" && slide.localPath) {
    return slide.localPath;
  }

  await ensureSlidesDirectory();
  const { data } = supabase.storage.from("slides").getPublicUrl(slide.path);

  const filename = `${Date.now()}-${sanitizeFilename(slide.name)}`;
  const destination = `${SLIDES_DIR}${filename}`;

  const downloaded = await FileSystem.downloadAsync(
    data.publicUrl,
    destination,
  );

  const map = await getOfflineSlideMap();
  map[slide.path] = downloaded.uri;
  await setOfflineSlideMap(map);

  return downloaded.uri;
}

export async function deleteSlide(slide: SlideFile) {
  const map = await getOfflineSlideMap();
  const mappedUri = map[slide.path] ?? slide.localPath;

  if (slide.source === "local") {
    const localSlides = await getStoredLocalSlides();
    const filtered = localSlides.filter((item) => item.id !== slide.id);
    await setStoredLocalSlides(filtered);

    await removeLocalFileIfExists(mappedUri);

    if (slide.path in map) {
      delete map[slide.path];
      await setOfflineSlideMap(map);
    }

    return { kind: "deleted" as const };
  }

  if (mappedUri) {
    await removeLocalFileIfExists(mappedUri);
    delete map[slide.path];
    await setOfflineSlideMap(map);
    return { kind: "offline-removed" as const };
  }

  throw new Error("Published slides cannot be deleted from this app.");
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
