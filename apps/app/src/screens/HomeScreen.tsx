import {
  StyleSheet,
  Text,
  View,
  Platform,
  TouchableOpacity,
} from "react-native";
import { MOOD_LABELS } from "@myonites/shared";
import { useAuthStore } from "../store/authStore";

interface HomeScreenProps {
  onNavigateToPosePrototype: () => void;
}

export function HomeScreen({ onNavigateToPosePrototype }: HomeScreenProps) {
  const { session, signOut } = useAuthStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Myonites</Text>
      <Text style={styles.subtitle}>
        Running on {Platform.OS} ({Platform.Version})
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Signed in</Text>
        <Text style={styles.cardBody}>{session?.email}</Text>
      </View>
      <View style={[styles.card, { marginTop: 12 }]}>
        <Text style={styles.cardTitle}>Shared Package Working</Text>
        <Text style={styles.cardBody}>
          Mood labels: {MOOD_LABELS.join(", ")}
        </Text>
      </View>

      {Platform.OS === "web" && (
        <TouchableOpacity
          style={styles.prototypeButton}
          onPress={onNavigateToPosePrototype}>
          <Text style={styles.prototypeButtonText}>
            Pose Estimation Prototype
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
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
    backgroundColor: "#f8f9fa",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 8,
    color: "#1a1a2e",
  },
  subtitle: {
    fontSize: 16,
    color: "#6c757d",
    marginBottom: 32,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    color: "#16a34a",
  },
  cardBody: {
    fontSize: 14,
    color: "#495057",
    lineHeight: 20,
  },
  prototypeButton: {
    backgroundColor: "#4f46e5",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  prototypeButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  signOut: {
    marginTop: 24,
    padding: 12,
  },
  signOutText: {
    color: "#dc2626",
    fontSize: 16,
    fontWeight: "600",
  },
});
