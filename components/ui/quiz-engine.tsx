import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import * as Haptics from "expo-haptics";

import type { QuizQuestion } from "@/types/models";

type Props = {
  questions: QuizQuestion[];
};

export function QuizEngine({ questions }: Props) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  if (!questions.length) {
    return (
      <View className="rounded-2xl border border-dashed border-[#89A7C5] p-4">
        <Text className="text-center text-sm text-[#35506B] dark:text-[#99B7D4]">
          Generate a quiz to start practicing.
        </Text>
      </View>
    );
  }

  const current = questions[index];
  const finished = index >= questions.length;

  if (finished) {
    return (
      <View className="rounded-2xl bg-[#003366] p-5">
        <Text className="text-xl font-bold text-white">Quiz Complete</Text>
        <Text className="mt-2 text-[#D8E7F8]">
          You scored {score}/{questions.length}
        </Text>
        <Pressable
          className="mt-4 self-start rounded-full bg-[#FFCC00] px-4 py-2"
          onPress={() => {
            setIndex(0);
            setScore(0);
            setSelected(null);
          }}
        >
          <Text className="font-semibold text-[#003366]">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="rounded-2xl border border-[#D5E0EB] bg-white p-4 dark:border-[#184267] dark:bg-[#071A2D]">
      <Text className="text-xs font-semibold uppercase tracking-wider text-[#5B7897] dark:text-[#7EA0C2]">
        Question {index + 1} of {questions.length}
      </Text>
      <Text className="mt-2 text-base font-semibold text-[#0C2F51] dark:text-[#E4EEF9]">
        {current.question}
      </Text>

      <View className="mt-4 gap-2">
        {current.options.map((option, optionIndex) => {
          const isCorrectOption = optionIndex === current.answerIndex;
          const isSelected = selected === optionIndex;

          let stateClass = "border-[#C5D6E8] bg-[#F9FBFD]";
          if (selected !== null && isCorrectOption)
            stateClass = "border-[#157347] bg-[#DFF4E8]";
          if (selected !== null && isSelected && !isCorrectOption)
            stateClass = "border-[#B42318] bg-[#FEE4E2]";

          return (
            <Pressable
              key={`${optionIndex}-${option.slice(0, 16)}`}
              disabled={selected !== null}
              onPress={async () => {
                setSelected(optionIndex);
                if (optionIndex === current.answerIndex) {
                  setScore((prev) => prev + 1);
                  await Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );
                } else {
                  await Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Error,
                  );
                }
              }}
              className={`rounded-xl border px-3 py-3 ${stateClass}`}
            >
              <Text className="text-sm text-[#163654]">{option}</Text>
            </Pressable>
          );
        })}
      </View>

      {selected !== null ? (
        <Pressable
          className="mt-4 self-start rounded-full bg-[#003366] px-4 py-2"
          onPress={() => {
            setIndex((prev) => prev + 1);
            setSelected(null);
          }}
        >
          <Text className="font-semibold text-white">Next Question</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
