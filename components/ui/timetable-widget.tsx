import { Text, View } from "react-native";

type Props = {
  course: string;
  venue: string;
  timeRemaining: string;
  progress: number;
};

export function TimetableWidget({
  course,
  venue,
  timeRemaining,
  progress,
}: Props) {
  return (
    <View className="rounded-3xl bg-[#003366] p-5 shadow-card dark:bg-[#010C18]">
      <Text className="text-xs font-semibold uppercase tracking-wide text-[#B0CAE4]">
        Current Class
      </Text>
      <Text className="mt-2 text-xl font-bold text-white">{course}</Text>
      <Text className="mt-1 text-sm text-[#D9E8F8]">Venue: {venue}</Text>

      <View className="mt-4 h-2 overflow-hidden rounded-full bg-[#1D4E80]">
        <View
          className="h-2 rounded-full bg-[#FFCC00]"
          style={{ width: `${Math.max(progress * 100, 3)}%` }}
        />
      </View>

      <Text className="mt-2 text-xs font-semibold text-[#FFCC00]">
        Time Remaining: {timeRemaining}
      </Text>
    </View>
  );
}
