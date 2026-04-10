import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

import { transcribeSnapshotWithGroq } from "@/lib/groq";

const NOTES_KEY = "upsa.snapshotNotes";

export type SnapshotNote = {
  id: string;
  course: string;
  text: string;
  createdAt: string;
};

export async function captureSnapshot() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Camera permission is required for snapshot note-taking.");
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsEditing: false,
    base64: false,
  });

  if (result.canceled || !result.assets.length) {
    return null;
  }

  return result.assets[0].uri;
}

async function loadNotes() {
  const raw = await AsyncStorage.getItem(NOTES_KEY);
  return raw ? (JSON.parse(raw) as SnapshotNote[]) : [];
}

export async function listSnapshotNotes() {
  return loadNotes();
}

export async function transcribeAndSaveSnapshot(
  imageUri: string,
  course: string,
) {
  const imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const transcript = await transcribeSnapshotWithGroq(imageBase64, course);

  const note: SnapshotNote = {
    id: `${Date.now()}`,
    course,
    text: transcript,
    createdAt: new Date().toISOString(),
  };

  const existing = await loadNotes();
  const updated = [note, ...existing].slice(0, 50);
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(updated));

  return note;
}
