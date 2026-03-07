/**
 * ScheduleTimeline
 *
 * Displays proposed workout slots on a visual timeline.
 * Slots are adjustable:
 *   - Tap a slot's time to open a picker and adjust it
 *   - On web, drag slot markers on the timeline
 *   - 20-minute minimum gap enforced between all slots
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { useTheme } from "../../hooks/useTheme";
import type { ProposedSlot } from "@myonites/shared";
import { validateSlotMove } from "@myonites/shared/src/engine/validateSchedule";
import type { AvailabilityBlock } from "@myonites/shared";

interface ScheduleTimelineProps {
  workStart: string;
  workEnd: string;
  slots: ProposedSlot[];
  availabilityBlocks: AvailabilityBlock[];
  onSlotsChange: (slots: ProposedSlot[]) => void;
}

function timeToMinutes(time: string): number {
  const parts = time.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function formatTime(isoOrHHMM: string): string {
  let h: number;
  let m: number;

  if (isoOrHHMM.includes("T")) {
    const timePart = isoOrHHMM.split("T")[1] ?? "00:00";
    const parts = timePart.split(":").map(Number);
    h = parts[0] ?? 0;
    m = parts[1] ?? 0;
  } else {
    const parts = isoOrHHMM.split(":").map(Number);
    h = parts[0] ?? 0;
    m = parts[1] ?? 0;
  }

  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:${m.toString().padStart(2, "0")} ${period}`;
}

function formatHour(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  if (m === 0) return `${display}${period}`;
  return `${display}:${m.toString().padStart(2, "0")}${period}`;
}

function slotTimeToMinutes(slot: ProposedSlot): number {
  if (slot.time.includes("T")) {
    const timePart = slot.time.split("T")[1] ?? "00:00";
    return timeToMinutes(timePart);
  }
  return timeToMinutes(slot.time);
}

function buildSlotTime(originalTime: string, newMinutes: number): string {
  const newTime = minutesToTime(newMinutes);
  if (originalTime.includes("T")) {
    const datePart = originalTime.split("T")[0] ?? "2026-01-01";
    return `${datePart}T${newTime}:00`;
  }
  return `${newTime}:00`;
}

const SNAP_MINUTES = 5;

function snap(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/* ─── Time Picker Modal ─────────────────────────────────── */

interface SlotTimePickerProps {
  visible: boolean;
  slot: ProposedSlot;
  slots: ProposedSlot[];
  availabilityBlocks: AvailabilityBlock[];
  workStart: number;
  workEnd: number;
  onSelect: (slotNumber: number, newTime: string) => void;
  onClose: () => void;
}

function SlotTimePicker({
  visible,
  slot,
  slots,
  availabilityBlocks,
  workStart,
  workEnd,
  onSelect,
  onClose,
}: SlotTimePickerProps) {
  const { colors } = useTheme();

  const options: { value: number; label: string; valid: boolean }[] = [];
  for (let m = workStart; m <= workEnd; m += SNAP_MINUTES) {
    const timeStr = buildSlotTime(slot.time, m);
    const result = validateSlotMove(
      slot.slotNumber,
      timeStr,
      slots,
      availabilityBlocks,
    );
    options.push({ value: m, label: formatHour(m), valid: result.valid });
  }

  const currentMinutes = slotTimeToMinutes(slot);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={pickerStyles.overlay}>
        <View
          style={[pickerStyles.content, { backgroundColor: colors.surface }]}>
          <Text style={[pickerStyles.title, { color: colors.text }]}>
            Move Slot {slot.slotNumber}
          </Text>
          <Text style={[pickerStyles.subtitle, { color: colors.textTertiary }]}>
            {slot.sessionType === "mental" ? "Mental Wellness" : "Physical"} —
            Currently {formatTime(slot.time)}
          </Text>

          <ScrollView
            style={pickerStyles.scroll}
            showsVerticalScrollIndicator={false}>
            {options.map((opt) => {
              const isCurrent = opt.value === currentMinutes;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    pickerStyles.option,
                    isCurrent && { backgroundColor: colors.primary },
                    !opt.valid && { opacity: 0.3 },
                  ]}
                  disabled={!opt.valid}
                  onPress={() => {
                    onSelect(
                      slot.slotNumber,
                      buildSlotTime(slot.time, opt.value),
                    );
                    onClose();
                  }}>
                  <Text
                    style={[
                      pickerStyles.optionText,
                      { color: colors.text },
                      isCurrent && { color: colors.primaryText },
                    ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[pickerStyles.cancelBtn, { borderColor: colors.border }]}
            onPress={onClose}>
            <Text
              style={[
                pickerStyles.cancelText,
                { color: colors.textSecondary },
              ]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Main Component ─────────────────────────────────────── */

export function ScheduleTimeline({
  workStart,
  workEnd,
  slots,
  availabilityBlocks,
  onSlotsChange,
}: ScheduleTimelineProps) {
  const { colors } = useTheme();
  const [editingSlot, setEditingSlot] = useState<ProposedSlot | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const trackRef = useRef<View | null>(null);
  const trackWebRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    slotNumber: number;
    startX: number;
    origMinutes: number;
  } | null>(null);

  const startMinutes = timeToMinutes(workStart);
  const endMinutes = timeToMinutes(workEnd);
  const totalMinutes = endMinutes - startMinutes;

  const minutesToPercent = (minutes: number) =>
    ((minutes - startMinutes) / totalMinutes) * 100;

  const handleSlotTimeChange = (slotNumber: number, newTime: string) => {
    const result = validateSlotMove(
      slotNumber,
      newTime,
      slots,
      availabilityBlocks,
    );

    if (!result.valid) {
      setValidationError(result.error);
      setTimeout(() => setValidationError(null), 3000);
      return;
    }

    const updated = slots.map((s) =>
      s.slotNumber === slotNumber ? { ...s, time: newTime } : s,
    );
    onSlotsChange(updated);
    setValidationError(null);
  };

  /* Web drag handlers */
  const handleSlotMouseDown = useCallback(
    (e: React.MouseEvent, slot: ProposedSlot) => {
      if (Platform.OS !== "web") return;
      e.preventDefault();
      e.stopPropagation();

      dragRef.current = {
        slotNumber: slot.slotNumber,
        startX: e.clientX,
        origMinutes: slotTimeToMinutes(slot),
      };
    },
    [],
  );

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || !trackWebRef.current) return;

      e.preventDefault();
      const rect = trackWebRef.current.getBoundingClientRect();
      const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const newMinutes = snap(startMinutes + ratio * totalMinutes);

      const slot = slots.find((s) => s.slotNumber === drag.slotNumber);
      if (!slot) return;

      const newTime = buildSlotTime(slot.time, newMinutes);
      const result = validateSlotMove(
        drag.slotNumber,
        newTime,
        slots,
        availabilityBlocks,
      );

      if (result.valid) {
        const updated = slots.map((s) =>
          s.slotNumber === drag.slotNumber ? { ...s, time: newTime } : s,
        );
        onSlotsChange(updated);
        setValidationError(null);
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [slots, onSlotsChange, availabilityBlocks, startMinutes, totalMinutes]);

  /* Hour labels */
  const hourLabels: { label: string; percent: number }[] = [];
  for (let h = Math.ceil(startMinutes / 60); h * 60 <= endMinutes; h++) {
    const minutes = h * 60;
    if (minutes >= startMinutes && minutes <= endMinutes) {
      hourLabels.push({
        label: formatHour(minutes),
        percent: minutesToPercent(minutes),
      });
    }
  }

  const timelineContent = (
    <>
      {/* Background track */}
      <View
        style={[
          styles.track,
          { backgroundColor: colors.border },
          { position: "absolute", left: 0, right: 0 },
        ]}
      />

      {/* Hour markers */}
      {hourLabels.map((h) => (
        <View
          key={h.label}
          style={[
            styles.hourMarker,
            {
              left: `${h.percent}%`,
              backgroundColor: colors.textTertiary,
            },
          ]}
        />
      ))}

      {/* Slot markers */}
      {slots.map((slot) => {
        const minutes = slotTimeToMinutes(slot);
        const percent = minutesToPercent(minutes);
        const isMental = slot.sessionType === "mental";

        const marker = (
          <View
            key={slot.slotNumber}
            style={[
              styles.slotMarker,
              {
                left: `${percent}%`,
                backgroundColor: isMental ? colors.success : colors.primary,
              },
            ]}>
            <Text style={styles.slotNumber}>{slot.slotNumber}</Text>
          </View>
        );

        if (Platform.OS === "web") {
          return (
            <div
              key={slot.slotNumber}
              onMouseDown={(e: React.MouseEvent) =>
                handleSlotMouseDown(e, slot)
              }
              style={{
                position: "absolute" as const,
                left: `${percent}%`,
                marginLeft: -18,
                width: 36,
                height: 36,
                top: 12,
                cursor: "grab",
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
              <View
                style={[
                  styles.slotMarkerInner,
                  {
                    backgroundColor: isMental ? colors.success : colors.primary,
                  },
                ]}>
                <Text style={styles.slotNumber}>{slot.slotNumber}</Text>
              </View>
            </div>
          );
        }

        return marker;
      })}
    </>
  );

  return (
    <View style={styles.container}>
      {/* Validation error */}
      {validationError && (
        <View
          style={[
            styles.errorBar,
            { backgroundColor: colors.dangerBackground },
          ]}>
          <Text style={[styles.errorText, { color: colors.dangerText }]}>
            {validationError}
          </Text>
        </View>
      )}

      {/* Timeline track */}
      {Platform.OS === "web" ? (
        <div
          ref={trackWebRef}
          style={{
            position: "relative" as const,
            height: 60,
            display: "flex",
            alignItems: "center",
            userSelect: "none" as const,
            touchAction: "none" as const,
          }}>
          {timelineContent}
        </div>
      ) : (
        <View ref={trackRef} style={styles.trackWrapper}>
          {timelineContent}
        </View>
      )}

      {/* Hour labels */}
      <View style={styles.labelsRow}>
        {hourLabels.map((h) => (
          <Text
            key={h.label}
            style={[
              styles.hourLabel,
              { color: colors.textTertiary, left: `${h.percent}%` },
            ]}>
            {h.label}
          </Text>
        ))}
      </View>

      {/* Slot details list — tappable times */}
      <View style={styles.slotList}>
        {slots.map((slot) => {
          const isMental = slot.sessionType === "mental";
          return (
            <View
              key={slot.slotNumber}
              style={[styles.slotRow, { borderColor: colors.border }]}>
              <View
                style={[
                  styles.slotBadge,
                  {
                    backgroundColor: isMental ? colors.success : colors.primary,
                  },
                ]}>
                <Text style={styles.slotBadgeText}>{slot.slotNumber}</Text>
              </View>
              <View style={styles.slotInfo}>
                <TouchableOpacity onPress={() => setEditingSlot(slot)}>
                  <Text
                    style={[
                      styles.slotTime,
                      {
                        color: colors.primary,
                        textDecorationLine: "underline",
                      },
                    ]}>
                    {formatTime(slot.time)}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.slotType, { color: colors.textTertiary }]}>
                  {isMental ? "Mental Wellness" : "Physical"} — Tap time to
                  adjust
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Slot time picker modal */}
      {editingSlot && (
        <SlotTimePicker
          visible
          slot={editingSlot}
          slots={slots}
          availabilityBlocks={availabilityBlocks}
          workStart={startMinutes}
          workEnd={endMinutes}
          onSelect={handleSlotTimeChange}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: {
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    maxHeight: 480,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
  },
  scroll: {
    maxHeight: 320,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
    alignItems: "center",
  },
  optionText: {
    fontSize: 16,
    fontWeight: "500",
  },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
  },
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  trackWrapper: {
    height: 60,
    position: "relative",
    justifyContent: "center",
  },
  track: {
    height: 4,
    borderRadius: 2,
  },
  hourMarker: {
    position: "absolute",
    width: 1,
    height: 12,
    top: 24,
  },
  slotMarker: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    top: 16,
    marginLeft: -14,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  slotMarkerInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  slotNumber: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  labelsRow: {
    height: 20,
    position: "relative",
    marginTop: 4,
  },
  hourLabel: {
    position: "absolute",
    fontSize: 10,
    fontWeight: "500",
    transform: [{ translateX: -12 }],
  },
  errorBar: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  slotList: {
    marginTop: 24,
    gap: 8,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  slotBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  slotBadgeText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  slotInfo: {
    flex: 1,
  },
  slotTime: {
    fontSize: 16,
    fontWeight: "600",
  },
  slotType: {
    fontSize: 12,
    marginTop: 2,
  },
});
