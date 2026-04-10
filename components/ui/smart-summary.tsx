import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { SmartSummary } from "@/types/models";

type Props = {
  summary: SmartSummary;
};

export function SmartSummaryCard({ summary }: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  return (
    <View className="rounded-2xl border border-[#D6E0EA] bg-white p-4 shadow-card dark:border-[#17406B] dark:bg-[#071A2D]">
      <Text className="text-xl font-bold text-[#003366] dark:text-[#FFCC00]">
        {summary.title}
      </Text>
      {summary.intro ? (
        <Text className="mt-1 text-sm text-[#3C556E] dark:text-[#B5C9DE]">
          {summary.intro}
        </Text>
      ) : null}

      <View className="mt-4 gap-2">
        {summary.items.map((item, index) => {
          const isOpen = expanded[index] ?? index === 0;
          return (
            <View
              key={`${item.title}-${index}`}
              className="overflow-hidden rounded-xl border border-[#E9EEF3] dark:border-[#133A60]"
            >
              <Pressable
                onPress={() =>
                  setExpanded((prev) => ({ ...prev, [index]: !isOpen }))
                }
                className="flex-row items-center justify-between bg-[#F4F7FB] px-3 py-2 dark:bg-[#09223A]"
              >
                <Text className="flex-1 text-sm font-semibold text-[#003366] dark:text-[#D8E7F8]">
                  {item.title}
                </Text>
                <Text className="text-lg font-bold text-[#003366] dark:text-[#FFCC00]">
                  {isOpen ? "-" : "+"}
                </Text>
              </Pressable>

              {isOpen ? (
                <View className="gap-1 px-3 py-2">
                  {item.bullets.map((bullet, bulletIndex) => (
                    <Text
                      key={`${bulletIndex}-${bullet.slice(0, 12)}`}
                      className="text-sm leading-6 text-[#20384F] dark:text-[#C0D6EA]"
                    >
                      {"\u2022"} {bullet}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
