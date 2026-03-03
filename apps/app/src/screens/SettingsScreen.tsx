import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useTheme } from "../hooks/useTheme";
import { useAuthStore } from "../store/authStore";
import { pushThemeToSupabase } from "../services/themeSync";
import type { ThemePreference } from "../store/themeStore";

interface SettingsScreenProps {
  onBack: () => void;
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { colors, preference, setPreference } = useTheme();
  const { session } = useAuthStore();

  const handleThemeChange = (value: ThemePreference) => {
    setPreference(value);
    if (session?.userId) {
      pushThemeToSupabase(session.userId, value);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Appearance
        </Text>

        {THEME_OPTIONS.map((option) => {
          const isSelected = preference === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.option,
                { borderColor: colors.border },
                isSelected && {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
              ]}
              onPress={() => handleThemeChange(option.value)}>
              <Text
                style={[
                  styles.optionText,
                  { color: colors.text },
                  isSelected && { color: colors.primaryText },
                ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
    maxWidth: 500,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 40,
  },
  section: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  option: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  optionText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
