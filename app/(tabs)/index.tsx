import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import colors from "@/constants/colors";


const C = colors.light;

type Feature = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  color: string;
  bgColor: string;
};

const FEATURES: Feature[] = [
  {
    id: "qr-scanner",
    title: "QR Scanner",
    subtitle: "Scan any QR code",
    icon: "camera",
    route: "/scanner",
    color: "#0099CC",
    bgColor: "rgba(0,153,204,0.1)",
  },
  {
    id: "qr-generator",
    title: "QR Generator",
    subtitle: "Create QR codes",
    icon: "grid",
    route: "/generator",
    color: "#7C3AED",
    bgColor: "rgba(124,58,237,0.1)",
  },
  {
    id: "doc-scanner",
    title: "Doc Scanner",
    subtitle: "Capture documents",
    icon: "file-text",
    route: "/document-scanner",
    color: "#10B981",
    bgColor: "rgba(16,185,129,0.1)",
  },
  {
    id: "edit-doc",
    title: "Edit Document",
    subtitle: "Crop & adjust",
    icon: "edit-2",
    route: "/edit-document",
    color: "#F59E0B",
    bgColor: "rgba(245,158,11,0.1)",
  },
  {
    id: "signature",
    title: "Signature",
    subtitle: "Draw & apply",
    icon: "pen-tool",
    route: "/signature",
    color: "#EF4444",
    bgColor: "rgba(239,68,68,0.1)",
  },
  {
    id: "watermark",
    title: "Watermark",
    subtitle: "Brand your docs",
    icon: "droplet",
    route: "/watermark",
    color: "#0891B2",
    bgColor: "rgba(8,145,178,0.1)",
  },
];

function FeatureCard({ feature }: { feature: Feature }) {
  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(feature.route as any);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, { backgroundColor: feature.bgColor }]}>
        <Feather name={feature.icon as any} size={24} color={feature.color} />
      </View>
      <Text style={styles.cardTitle}>{feature.title}</Text>
      <Text style={styles.cardSubtitle}>{feature.subtitle}</Text>
      <View style={styles.cardArrow}>
        <Feather name="chevron-right" size={15} color={C.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 20, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>UltraScan</Text>
            <Text style={styles.tagline}>All-in-One Scanner Toolkit</Text>
          </View>
          <View style={styles.headerBadge}>
            <Feather name="wifi-off" size={13} color={C.primary} />
            <Text style={styles.headerBadgeText}>Offline</Text>
          </View>
        </View>

        {/* Quick Action Banner */}
        <TouchableOpacity
          style={styles.quickScanBanner}
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            // router.push("/scanner");
          }}
          activeOpacity={0.85}
        >
          <View style={styles.quickScanLeft}>
            <View style={styles.quickScanIcon}>
              <Feather name="zap" size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.quickScanTitle}>Quick Scan</Text>
              <Text style={styles.quickScanSub}>Tap to open camera</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        {/* Section Title */}
        <Text style={styles.sectionTitle}>All Tools</Text>

        {/* Feature Grid */}
        <View style={styles.grid}>
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  appName: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: C.text,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    marginTop: 2,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,153,204,0.1)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(0,153,204,0.2)",
  },
  headerBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
  },
  quickScanBanner: {
    backgroundColor: C.primary,
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
    // shadowColor: C.primary,
    // shadowOffset: { width: 0, height: 4 },
    // shadowOpacity: 0.3,
    // shadowRadius: 12,
    elevation: 6,
  },
  quickScanLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  quickScanIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickScanTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  quickScanSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.text,
    marginBottom: 14,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    width: "47.5%",
    borderRadius: 18,
    padding: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    position: "relative",
    // shadowColor: "#000",
    // shadowOffset: { width: 0, height: 1 },
    // shadowOpacity: 0.06,
    // shadowRadius: 6,
    elevation: 2,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: C.text,
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  cardArrow: {
    position: "absolute",
    top: 14,
    right: 14,
  },
});
