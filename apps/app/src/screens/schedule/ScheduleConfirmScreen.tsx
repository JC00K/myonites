/**
 * ScheduleConfirmScreen
 *
 * Displays the proposed workout schedule on a visual timeline.
 * Users can adjust individual slot times by tapping or dragging.
 * Shows warnings if the engine couldn't fit all 6 sessions.
 */

import { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { ScheduleTimeline } from "../../components/schedule/ScheduleTimeline";
import type { ScheduleConfig } from "./ScheduleSetupScreen";
import type { DayKey } from "../../components/schedule/DaySelector";
import type { ProposedSlot } from "@myonites/shared";

interface ScheduleConfirmScreenProps {
  config: ScheduleConfig;
  onConfirm: (config: ScheduleConfig) => Promise<void>;
  onBack: () => void;
}

const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function ScheduleConfirmScreen({
  config,
  onConfirm,
  onBack,
}: ScheduleConfirmScreenProps) {
  const { colors } = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentConfig, setCurrentConfig] = useState(config);

  const sortedDays = currentConfig.workDays
    .slice()
    .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));

  const sampleSlots = currentConfig.proposals.get(sortedDays[0]!) ?? [];

  const handleSlotsChange = (updatedSlots: ProposedSlot[]) => {
    const newProposals = new Map(currentConfig.proposals);
    for (const day of currentConfig.workDays) {
      newProposals.set(day, updatedSlots);
    }
    setCurrentConfig({ ...currentConfig, proposals: newProposals });
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(currentConfig);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save schedule.";
      Alert.alert("Error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: colors.text }]}>Your Schedule</Text>
      <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
        {sampleSlots.length} sessions per day. Tap or drag times to adjust.
      </Text>

      {/* Timeline with adjustable slots */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}>
        <ScheduleTimeline
          workStart={currentConfig.workStart}
          workEnd={currentConfig.workEnd}
          slots={sampleSlots}
          availabilityBlocks={currentConfig.availabilityBlocks}
          onSlotsChange={handleSlotsChange}
        />
      </View>

      {/* Days this applies to */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Applies To
        </Text>
        <View style={styles.dayTags}>
          {sortedDays.map((day) => (
            <View
              key={day}
              style={[
                styles.dayTag,
                {
                  backgroundColor: colors.primary + "20",
                  borderColor: colors.primary,
                },
              ]}>
              <Text style={[styles.dayTagText, { color: colors.primary }]}>
                {DAY_LABELS[day]}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Schedule info */}
      <View
        style={[
          styles.infoCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>
            Work Window
          </Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {formatDisplayTime(currentConfig.workStart)} –{" "}
            {formatDisplayTime(currentConfig.workEnd)}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>
            Sessions
          </Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {sampleSlots.filter((s) => s.sessionType === "physical").length}{" "}
            physical +{" "}
            {sampleSlots.filter((s) => s.sessionType === "mental").length}{" "}
            mental
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>
            Availability Blocks
          </Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {currentConfig.availabilityBlocks.length}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={[
          styles.confirmButton,
          { backgroundColor: colors.primary },
          isSubmitting && styles.disabled,
        ]}
        onPress={handleConfirm}
        disabled={isSubmitting}>
        {isSubmitting ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={[styles.confirmText, { color: colors.primaryText }]}>
            Confirm Schedule
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.adjustButton, { borderColor: colors.border }]}
        onPress={onBack}>
        <Text style={[styles.adjustText, { color: colors.textSecondary }]}>
          Adjust Settings
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function formatDisplayTime(time: string): string {
  const parts = time.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:${m.toString().padStart(2, "0")} ${period}`;
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
    marginBottom: 24,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 12,
  },
  dayTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayTag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  dayTagText: {
    fontSize: 13,
    fontWeight: "600",
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 32,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  confirmButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  disabled: {
    opacity: 0.6,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: "600",
  },
  adjustButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
  },
  adjustText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
