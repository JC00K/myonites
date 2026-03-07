/**
 * ScheduleSetupScreen
 *
 * Reusable screen for configuring the weekly schedule.
 * Used by both onboarding (first time) and the update
 * schedule flow (from home screen).
 *
 * Collects: work days, work window, availability blocks.
 * Availability defaults to the full shift and updates
 * when the work window changes.
 */

import { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
} from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DaySelector } from "../../components/schedule/DaySelector";
import type { DayKey } from "../../components/schedule/DaySelector";
import { WorkWindowPicker } from "../../components/schedule/WorkWindowPicker";
import { TimelinePicker } from "../../components/schedule/TimelinePicker";
import type { AvailabilityBlock, ProposedSlot } from "@myonites/shared";
import { proposeSchedule } from "@myonites/shared/src/engine/scheduling";

interface ScheduleSetupScreenProps {
  onConfirm: (config: ScheduleConfig) => void;
  onBack?: () => void;
  isOnboarding?: boolean;
}

export interface ScheduleConfig {
  workDays: DayKey[];
  workStart: string;
  workEnd: string;
  availabilityBlocks: AvailabilityBlock[];
  proposals: Map<DayKey, ProposedSlot[]>;
}

export function ScheduleSetupScreen({
  onConfirm,
  onBack,
  isOnboarding = false,
}: ScheduleSetupScreenProps) {
  const { colors } = useTheme();

  const [workDays, setWorkDays] = useState<DayKey[]>([
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
  ]);
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("17:00");
  const [availabilityBlocks, setAvailabilityBlocks] = useState<
    AvailabilityBlock[]
  >([{ start: "09:00", end: "17:00" }]);
  const [hasManuallyEditedBlocks, setHasManuallyEditedBlocks] = useState(false);

  /* Update availability to match work window when it changes,
     unless the user has manually edited their blocks */
  useEffect(() => {
    if (!hasManuallyEditedBlocks) {
      setAvailabilityBlocks([{ start: workStart, end: workEnd }]);
    }
  }, [workStart, workEnd, hasManuallyEditedBlocks]);

  const handleBlocksChange = (blocks: AvailabilityBlock[]) => {
    setHasManuallyEditedBlocks(true);
    setAvailabilityBlocks(blocks);
  };

  const handleContinue = () => {
    if (workDays.length === 0) {
      Alert.alert(
        "No work days selected",
        "Please select at least one work day.",
      );
      return;
    }

    const today = new Date().toISOString().split("T")[0] ?? "2026-01-01";

    const result = proposeSchedule({
      workWindowStart: workStart,
      workWindowEnd: workEnd,
      availabilityBlocks,
      date: today,
    });

    if (result.slots.length === 0) {
      Alert.alert(
        "Cannot create schedule",
        result.warnings[0] ?? "Not enough available time for workouts.",
      );
      return;
    }

    if (result.warnings.length > 0) {
      Alert.alert("Note", result.warnings.join("\n"));
    }

    const proposals = new Map<DayKey, ProposedSlot[]>();
    for (const day of workDays) {
      proposals.set(day, result.slots);
    }

    onConfirm({
      workDays,
      workStart,
      workEnd,
      availabilityBlocks,
      proposals,
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </TouchableOpacity>
      )}

      <Text style={[styles.title, { color: colors.text }]}>
        {isOnboarding ? "Set Up Your Schedule" : "Update Schedule"}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
        {isOnboarding
          ? "Tell us about your work week so we can schedule your workouts."
          : "Adjust your work days, hours, and availability."}
      </Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Work Days
        </Text>
        <DaySelector selected={workDays} onChange={setWorkDays} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Work Hours
        </Text>
        <Text style={[styles.sectionHint, { color: colors.textTertiary }]}>
          When does your shift start and end?
        </Text>
        <WorkWindowPicker
          startTime={workStart}
          endTime={workEnd}
          onChangeStart={setWorkStart}
          onChangeEnd={setWorkEnd}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Availability
        </Text>
        <Text style={[styles.sectionHint, { color: colors.textTertiary }]}>
          Your full shift is available by default. Add blocks around meetings or
          breaks if needed.
        </Text>
        <TimelinePicker
          workStart={workStart}
          workEnd={workEnd}
          blocks={availabilityBlocks}
          onChange={handleBlocksChange}
        />
      </View>

      <TouchableOpacity
        style={[styles.continueButton, { backgroundColor: colors.primary }]}
        onPress={handleContinue}>
        <Text style={[styles.continueText, { color: colors.primaryText }]}>
          Preview Schedule
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    maxWidth: 1000,
    width: "100%",
    alignSelf: "center",
  },
  backButton: {
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  continueButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  continueText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
