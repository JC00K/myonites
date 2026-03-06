/**
 * TimelinePicker (Native)
 *
 * Placeholder — uses a list-based editing approach for now.
 * Will be replaced with gesture-handler based slider once
 * the web version is confirmed working.
 */

import { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
} from "react-native";
import { useTheme } from "../../hooks/useTheme";
import {
  timeToMinutes,
  minutesToTime,
  minutesToPercent,
  formatTime12,
  mergeBlocks,
  generateHourLabels,
  createNewBlock,
  MIN_BLOCK_MINUTES,
  SNAP_MINUTES,
} from "./timelineUtils";
import type { TimelinePickerProps } from "./timelineUtils";

const LONG_PRESS_MS = 3000;

function generateTimeOptions(
  rangeStart: number,
  rangeEnd: number,
): { value: string; label: string; minutes: number }[] {
  const options: { value: string; label: string; minutes: number }[] = [];
  for (let m = rangeStart; m <= rangeEnd; m += SNAP_MINUTES) {
    const time = minutesToTime(m);
    options.push({ value: time, label: formatTime12(time), minutes: m });
  }
  return options;
}

interface TimeSelectorProps {
  visible: boolean;
  title: string;
  currentTime: string;
  minTime: number;
  maxTime: number;
  onSelect: (time: string) => void;
  onClose: () => void;
}

function TimeSelector({
  visible,
  title,
  currentTime,
  minTime,
  maxTime,
  onSelect,
  onClose,
}: TimeSelectorProps) {
  const { colors } = useTheme();
  const options = generateTimeOptions(minTime, maxTime);
  const currentMinutes = timeToMinutes(currentTime);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View
          style={[modalStyles.content, { backgroundColor: colors.surface }]}>
          <Text style={[modalStyles.title, { color: colors.text }]}>
            {title}
          </Text>
          <ScrollView
            style={modalStyles.scroll}
            showsVerticalScrollIndicator={false}>
            {options.map((opt) => {
              const isSelected = opt.minutes === currentMinutes;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    modalStyles.option,
                    isSelected && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => {
                    onSelect(opt.value);
                    onClose();
                  }}>
                  <Text
                    style={[
                      modalStyles.optionText,
                      { color: colors.text },
                      isSelected && { color: colors.primaryText },
                    ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={[modalStyles.cancelBtn, { borderColor: colors.border }]}
            onPress={onClose}>
            <Text
              style={[modalStyles.cancelText, { color: colors.textSecondary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function TimelinePicker({
  workStart,
  workEnd,
  blocks,
  onChange,
}: TimelinePickerProps) {
  const { colors } = useTheme();
  const [editingBlock, setEditingBlock] = useState<{
    index: number;
    edge: "start" | "end";
  } | null>(null);
  const [longPressIndex, setLongPressIndex] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startMin = timeToMinutes(workStart);
  const endMin = timeToMinutes(workEnd);
  const totalMin = endMin - startMin;
  const hourLabels = generateHourLabels(startMin, endMin, totalMin);

  const getStartConstraints = (index: number) => {
    const prev = index > 0 ? blocks[index - 1] : null;
    const min = prev ? timeToMinutes(prev.end) + SNAP_MINUTES : startMin;
    const max = timeToMinutes(blocks[index]!.end) - MIN_BLOCK_MINUTES;
    return { min, max };
  };

  const getEndConstraints = (index: number) => {
    const next = index < blocks.length - 1 ? blocks[index + 1] : null;
    const min = timeToMinutes(blocks[index]!.start) + MIN_BLOCK_MINUTES;
    const max = next ? timeToMinutes(next.start) - SNAP_MINUTES : endMin;
    return { min, max };
  };

  const updateBlockTime = (
    index: number,
    edge: "start" | "end",
    time: string,
  ) => {
    const updated = [...blocks];
    if (edge === "start") {
      updated[index] = { start: time, end: blocks[index]!.end };
    } else {
      updated[index] = { start: blocks[index]!.start, end: time };
    }
    onChange(mergeBlocks(updated));
  };

  const addBlock = () => {
    const newBlock = createNewBlock(blocks, startMin, endMin);
    if (!newBlock) return;
    onChange(mergeBlocks([...blocks, newBlock]));
  };

  const removeBlock = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
    setLongPressIndex(null);
  };

  const handleLongPressIn = (index: number) => {
    longPressTimer.current = setTimeout(
      () => setLongPressIndex(index),
      LONG_PRESS_MS,
    );
  };

  const handleLongPressOut = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const editingConstraints = editingBlock
    ? editingBlock.edge === "start"
      ? getStartConstraints(editingBlock.index)
      : getEndConstraints(editingBlock.index)
    : { min: 0, max: 0 };

  const editingCurrentTime = editingBlock
    ? editingBlock.edge === "start"
      ? blocks[editingBlock.index]!.start
      : blocks[editingBlock.index]!.end
    : "00:00";

  return (
    <View style={styles.container}>
      {/* Long-press delete bar */}
      {longPressIndex !== null && blocks[longPressIndex] && (
        <View style={styles.actionBar}>
          <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>
            {formatTime12(blocks[longPressIndex]!.start)} –{" "}
            {formatTime12(blocks[longPressIndex]!.end)}
          </Text>
          <TouchableOpacity
            style={[styles.deleteBtn, { backgroundColor: colors.danger }]}
            onPress={() => removeBlock(longPressIndex)}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.border }]}
            onPress={() => setLongPressIndex(null)}>
            <Text
              style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Read-only visual timeline */}
      <View style={styles.timeline}>
        <View style={[styles.track, { backgroundColor: colors.border }]} />
        {hourLabels.map((h) => (
          <View
            key={h.label}
            style={[
              styles.tick,
              { left: `${h.percent}%`, backgroundColor: colors.textTertiary },
            ]}
          />
        ))}
        {blocks.map((block, index) => {
          const left = minutesToPercent(
            timeToMinutes(block.start),
            startMin,
            totalMin,
          );
          const width =
            minutesToPercent(timeToMinutes(block.end), startMin, totalMin) -
            left;
          return (
            <View
              key={index}
              style={[
                styles.block,
                {
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: colors.primary + "30",
                  borderColor: colors.primary + "70",
                },
              ]}>
              {width > 12 && (
                <Text
                  style={[styles.blockLabel, { color: colors.primary }]}
                  numberOfLines={1}>
                  {formatTime12(block.start)} – {formatTime12(block.end)}
                </Text>
              )}
            </View>
          );
        })}
      </View>

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

      {/* Editable block list */}
      <View style={styles.blockList}>
        {blocks.map((block, index) => {
          const duration =
            timeToMinutes(block.end) - timeToMinutes(block.start);
          return (
            <View
              key={index}
              style={[
                styles.blockRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onTouchStart={() => handleLongPressIn(index)}
              onTouchEnd={handleLongPressOut}
              onTouchCancel={handleLongPressOut}>
              <View
                style={[styles.blockDot, { backgroundColor: colors.primary }]}
              />
              <TouchableOpacity
                style={[
                  styles.timeChip,
                  {
                    backgroundColor: colors.primary + "15",
                    borderColor: colors.primary + "40",
                  },
                ]}
                onPress={() => setEditingBlock({ index, edge: "start" })}>
                <Text style={[styles.timeChipText, { color: colors.primary }]}>
                  {formatTime12(block.start)}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.timeSep, { color: colors.textTertiary }]}>
                to
              </Text>
              <TouchableOpacity
                style={[
                  styles.timeChip,
                  {
                    backgroundColor: colors.primary + "15",
                    borderColor: colors.primary + "40",
                  },
                ]}
                onPress={() => setEditingBlock({ index, edge: "end" })}>
                <Text style={[styles.timeChipText, { color: colors.primary }]}>
                  {formatTime12(block.end)}
                </Text>
              </TouchableOpacity>
              <Text
                style={[styles.durationText, { color: colors.textTertiary }]}>
                {duration} min
              </Text>
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.addBtn, { borderColor: colors.primary }]}
        onPress={addBlock}>
        <Text style={[styles.addBtnText, { color: colors.primary }]}>
          + Add Available Block
        </Text>
      </TouchableOpacity>

      {editingBlock && (
        <TimeSelector
          visible
          title={editingBlock.edge === "start" ? "Block Start" : "Block End"}
          currentTime={editingCurrentTime}
          minTime={editingConstraints.min}
          maxTime={editingConstraints.max}
          onSelect={(time) =>
            updateBlockTime(editingBlock.index, editingBlock.edge, time)
          }
          onClose={() => setEditingBlock(null)}
        />
      )}
    </View>
  );
}

const modalStyles = StyleSheet.create({
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
    marginBottom: 16,
  },
  scroll: { maxHeight: 320 },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
    alignItems: "center",
  },
  optionText: { fontSize: 16, fontWeight: "500" },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelText: { fontSize: 15, fontWeight: "600" },
});

const styles = StyleSheet.create({
  container: { width: "100%" },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    paddingVertical: 8,
  },
  actionLabel: { flex: 1, fontSize: 14, fontWeight: "500" },
  deleteBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  deleteBtnText: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
  },
  cancelBtnText: { fontSize: 13, fontWeight: "600" },
  timeline: { height: 56, position: "relative", justifyContent: "center" },
  track: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
  },
  tick: { position: "absolute", width: 1, height: 14, top: 21 },
  block: {
    position: "absolute",
    height: 40,
    top: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  blockLabel: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 4,
  },
  labelsRow: { height: 22, position: "relative", marginTop: 2 },
  hourLabel: {
    position: "absolute",
    fontSize: 10,
    fontWeight: "500",
    transform: [{ translateX: -14 }],
  },
  blockList: { marginTop: 20, gap: 10 },
  blockRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  blockDot: { width: 10, height: 10, borderRadius: 5 },
  timeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
  },
  timeChipText: { fontSize: 14, fontWeight: "600" },
  timeSep: { fontSize: 13 },
  durationText: { fontSize: 13, fontWeight: "500" },
  addBtn: {
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: "dashed",
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  addBtnText: { fontSize: 14, fontWeight: "600" },
});
