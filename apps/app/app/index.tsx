import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useAuthStore } from "../src/store/authStore";
import { LoginScreen } from "../src/screens/auth/LoginScreen";
import { SignUpScreen } from "../src/screens/auth/SignUpScreen";
import { ResetPasswordScreen } from "../src/screens/auth/ResetPasswordScreen";
import { HomeScreen } from "../src/screens/HomeScreen";
import { PosePrototypeScreen } from "../src/screens/pose/PosePrototypeScreen";

type AuthView = "login" | "signup" | "reset";
type AppView = "home" | "pose-prototype";

export default function Index() {
  const { session, isLoading, initialize } = useAuthStore();
  const [authView, setAuthView] = useState<AuthView>("login");
  const [appView, setAppView] = useState<AppView>("home");

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1a1a2e" />
      </View>
    );
  }

  if (session) {
    if (appView === "pose-prototype") {
      return <PosePrototypeScreen onBack={() => setAppView("home")} />;
    }
    return (
      <HomeScreen
        onNavigateToPosePrototype={() => setAppView("pose-prototype")}
      />
    );
  }

  switch (authView) {
    case "signup":
      return <SignUpScreen onNavigateToLogin={() => setAuthView("login")} />;
    case "reset":
      return (
        <ResetPasswordScreen onNavigateToLogin={() => setAuthView("login")} />
      );
    default:
      return (
        <LoginScreen
          onNavigateToSignUp={() => setAuthView("signup")}
          onNavigateToReset={() => setAuthView("reset")}
        />
      );
  }
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
});
