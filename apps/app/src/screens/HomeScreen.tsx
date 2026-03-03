import {
  StyleSheet,
  Text,
  View,
  Platform,
  TouchableOpacity,
} from "react-native";
import { MOOD_LABELS } from "@myonites/shared";
import { useAuthStore } from "../store/authStore";
import { useTheme } from "../hooks/useTheme";

interface HomeScreenProps {
  onNavigateToPosePrototype: () => void;
  onNavigateToSettings: () => void;
}

export function HomeScreen({
  onNavigateToPosePrototype,
  onNavigateToSettings,
}: HomeScreenProps) {
  const { session, signOut } = useAuthStore();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Myonites</Text>
      <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
        Running on {Platform.OS} ({Platform.Version})
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, shadowColor: colors.shadow },
        ]}>
        <Text style={[styles.cardTitle, { color: colors.success }]}>
          Signed in
        </Text>
        <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
          {session?.email}
        </Text>
      </View>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            shadowColor: colors.shadow,
            marginTop: 12,
          },
        ]}>
        <Text style={[styles.cardTitle, { color: colors.success }]}>
          Shared Package Working
        </Text>
        <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
          Mood labels: {MOOD_LABELS.join(", ")}
        </Text>
      </View>

      {Platform.OS === "web" && (
        <TouchableOpacity
          style={[styles.prototypeButton, { backgroundColor: colors.primary }]}
          onPress={onNavigateToPosePrototype}>
          <Text
            style={[styles.prototypeButtonText, { color: colors.primaryText }]}>
            Pose Estimation Prototype
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[
          styles.settingsButton,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onPress={onNavigateToSettings}>
        <Text style={[styles.settingsButtonText, { color: colors.text }]}>
          Settings
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOut} onPress={signOut}>
        <Text style={[styles.signOutText, { color: colors.danger }]}>
          Sign Out
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  prototypeButton: {
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  prototypeButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  settingsButton: {
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 12,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    borderWidth: 1,
  },
  settingsButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  signOut: {
    marginTop: 24,
    padding: 12,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
