import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import { saveFile } from "@/lib/fileStore";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import Colors from "@/constants/colors";

const C = Colors.light;

const QR_SIZE = 220;

type QRCategory = { label: string; placeholder: string };
const CATEGORIES: QRCategory[] = [
  { label: "Text", placeholder: "Enter any text..." },
  { label: "URL", placeholder: "https://example.com" },
  { label: "Email", placeholder: "email@example.com" },
  { label: "Phone", placeholder: "+1234567890" },
  { label: "SMS", placeholder: "+1234567890" },
  { label: "WiFi", placeholder: "SSID:Network;T:WPA;P:password;;" },
];

function generateQRUrl(text: string): string {
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encoded}&format=png&bgcolor=FFFFFF&color=111827&qzone=2`;
}

export default function GeneratorScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const [text, setText] = useState("");
  const [generated, setGenerated] = useState(false);
  const [selectedCat, setSelectedCat] = useState(0);
  const viewShotRef = useRef<ViewShot>(null);

  const fullText = text.trim();

  const handleGenerate = async () => {
    if (!fullText) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGenerated(true);
  };

  const handleSave = async () => {
    if (!fullText) return;
    try {
      const qrUrl = generateQRUrl(fullText);
      const saved = await saveFile("qrcodes", qrUrl, "qr", "png");
      if (Platform.OS !== "web") {
        try {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status === "granted") await MediaLibrary.saveToLibraryAsync(saved);
        } catch {}
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", "QR code saved to Files.");
    } catch (e) {
      Alert.alert("Error", "Could not save QR code.");
    }
  };

  const handleShare = async () => {
    if (!fullText) return;
    try {
      const qrUrl = generateQRUrl(fullText);
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.open(qrUrl, "_blank");
        return;
      }
      const localPath = FileSystem.Directory + `qr_${Date.now()}.png`;
      await FileSystem.downloadAsync(qrUrl, localPath);
      await Sharing.shareAsync(localPath);
    } catch (e) {
      Alert.alert("Error", "Could not share QR code.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR Generator</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catScroll}
          contentContainerStyle={styles.catContent}
        >
          {CATEGORIES.map((cat, idx) => (
            <TouchableOpacity
              key={cat.label}
              style={[styles.catChip, selectedCat === idx && styles.catChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedCat(idx);
                setText("");
                setGenerated(false);
              }}
            >
              <Text
                style={[
                  styles.catChipText,
                  selectedCat === idx && styles.catChipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>{CATEGORIES[selectedCat].label} Content</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder={CATEGORIES[selectedCat].placeholder}
              placeholderTextColor={C.textTertiary}
              value={text}
              onChangeText={(v) => { setText(v); setGenerated(false); }}
              autoCapitalize="none"
              autoCorrect={false}
              multiline={selectedCat === 0}
              numberOfLines={selectedCat === 0 ? 3 : 1}
              keyboardType={selectedCat === 3 || selectedCat === 4 ? "phone-pad" : "default"}
              returnKeyType="done"
              onSubmitEditing={handleGenerate}
            />
            {text.length > 0 && (
              <TouchableOpacity style={styles.clearBtn} onPress={() => { setText(""); setGenerated(false); }}>
                <Feather name="x" size={16} color={C.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={[styles.generateBtn, !fullText && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={!fullText}
          activeOpacity={0.8}
        >
          <Feather name="grid" size={18} color={fullText ? "#fff" : C.textTertiary} />
          <Text style={[styles.generateBtnText, !fullText && styles.generateBtnTextDisabled]}>
            Generate QR Code
          </Text>
        </TouchableOpacity>

        {/* QR Preview */}
        {generated && fullText && (
          <View style={styles.qrSection}>
            <View style={styles.qrCard}>
              <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1 }}>
                <View style={styles.qrContainer}>
                  <Image
                    source={{ uri: generateQRUrl(fullText) }}
                    style={{ width: QR_SIZE, height: QR_SIZE, borderRadius: 8 }}
                    resizeMode="contain"
                  />
                </View>
              </ViewShot>
              <Text style={styles.qrCaption} numberOfLines={2}>
                {fullText.length > 60 ? fullText.slice(0, 60) + "..." : fullText}
              </Text>
            </View>

            <View style={styles.qrActions}>
              <TouchableOpacity style={styles.qrActionBtn} onPress={handleSave}>
                <Feather name="download" size={20} color={C.primary} />
                <Text style={styles.qrActionText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.qrActionBtn} onPress={handleShare}>
                <Feather name="share" size={20} color={C.primary} />
                <Text style={styles.qrActionText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.qrActionBtn}
                onPress={() => { setText(""); setGenerated(false); }}
              >
                <Feather name="refresh-cw" size={20} color={C.primary} />
                <Text style={styles.qrActionText}>New</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Livvic_700Bold",
    color: C.text,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  catScroll: { marginBottom: 22, marginHorizontal: -20 },
  catContent: { paddingHorizontal: 20, gap: 8 },
  catChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  catChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  catChipText: { fontSize: 13, fontFamily: "Livvic_500Medium", color: C.textSecondary },
  catChipTextActive: { color: "#fff" },
  inputSection: { marginBottom: 18 },
  inputLabel: {
    fontSize: 12,
    fontFamily: "Livvic_600SemiBold",
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputWrap: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingRight: 10,
  },
  input: {
    flex: 1,
    padding: 14,
    fontSize: 15,
    fontFamily: "Livvic_400Regular",
    color: C.text,
    minHeight: 50,
  },
  clearBtn: {
    marginTop: 14,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  generateBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 28,
  },
  generateBtnDisabled: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  generateBtnText: { fontSize: 16, fontFamily: "Livvic_700Bold", color: "#fff" },
  generateBtnTextDisabled: { color: C.textTertiary },
  qrSection: { alignItems: "center" },
  qrCard: {
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    width: "100%",
    marginBottom: 16,
  },
  qrContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
  },
  qrCaption: {
    fontSize: 13,
    fontFamily: "Livvic_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },
  qrActions: { flexDirection: "row", gap: 12, width: "100%" },
  qrActionBtn: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  qrActionText: { fontSize: 12, fontFamily: "Livvic_600SemiBold", color: C.textSecondary },
});
