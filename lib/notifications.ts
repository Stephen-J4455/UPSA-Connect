import Constants from "expo-constants";

import type { TimetableEntry } from "@/types/models";

type NotificationsModule = typeof import("expo-notifications");

let notificationsModule: NotificationsModule | null | undefined;
let isHandlerRegistered = false;

function getNotificationsModule(): NotificationsModule | null {
  if (notificationsModule !== undefined) {
    return notificationsModule;
  }

  // Expo Go no longer supports Android push notifications via expo-notifications.
  if (Constants.appOwnership === "expo") {
    notificationsModule = null;
    return notificationsModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = require("expo-notifications") as NotificationsModule;

    if (!isHandlerRegistered) {
      notificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      isHandlerRegistered = true;
    }
  } catch {
    notificationsModule = null;
  }

  return notificationsModule;
}

export async function ensureNotificationPermissions() {
  const Notifications = getNotificationsModule();
  if (!Notifications) {
    return false;
  }

  const permissions = await Notifications.requestPermissionsAsync();
  return (
    permissions.granted ||
    permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

function toDate(dayOfWeek: number, time: string) {
  const now = new Date();
  const [hour, minute] = time.split(":").map(Number);
  const d = new Date(now);
  const delta = dayOfWeek - now.getDay();
  d.setDate(now.getDate() + delta);
  d.setHours(hour, minute, 0, 0);

  if (d < now) {
    d.setDate(d.getDate() + 7);
  }

  return d;
}

export async function scheduleLectureReminder(entry: TimetableEntry) {
  const Notifications = getNotificationsModule();
  if (!Notifications) {
    return;
  }

  const targetDate = toDate(entry.dayOfWeek, entry.startTime);
  const reminderDate = new Date(targetDate.getTime() - 15 * 60 * 1000);

  if (reminderDate < new Date()) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "UPSA Lecture Reminder",
      body: `Your '${entry.course}' class starts in 15 mins at ${entry.venue}. Don't be late!`,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
    },
  });
}
