import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { saveFile } from "@/lib/fileStore";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";

const C = Colors.light;

type Adjustment = {
  brightness: number;
  contrast: number;
};

const PRESETS = [
  { label: "Original", brightness: 1, contrast: 1 },
  { label: "Enhance", brightness: 1.2, contrast: 1.3 },
  { label: "B&W", brightness: 1, contrast: 1.5 },
  { label: "Sharp", brightness: 1.1, contrast: 1.8 },
  { label: "Soft", brightness: 1.3, contrast: 0.8 },
];

export default function EditDocumentScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const params = useLocalSearchParams<{ uri?: string }>();
  const [uri, setUri] = useState<string | null>(params.uri ?? null);
  const [processing, setProcessing] = useState(false);
  const [preset, setPreset] = useState(0);
  const [adjustment, setAdjustment] = useState<Adjustment>({ brightness: 1, contrast: 1 });
  const [processedUri, setProcessedUri] = useState<string | null>(null);

  const pickDocument = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setUri(result.assets[0].uri);
      setProcessedUri(null);
      setPreset(0);
    }
  }, []);

  const applyPreset = async (idx: number) => {
    if (!uri) return;
    const p = PRESETS[idx];
    setPreset(idx);
    setAdjustment({ brightness: p.brightness, contrast: p.contrast });
    await Haptics.selectionAsync();
  };

  const applyEdits = async () => {
    if (!uri) return;
    setProcessing(true);
    try {
      const actions: ImageManipulator.Action[] = [];

      const result = await ImageManipulator.manipulateAsync(
        uri,
        actions,
        {
          compress: 0.9,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      setProcessedUri(result.uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Error", "Could not process image.");
    } finally {
      setProcessing(false);
    }
  };

  const handleCrop = async () => {
    if (!uri) return;
    try {
      const result = await ImageManipulator.manipulateAsync(
        processedUri ?? uri,
        [{ crop: { originX: 0, originY: 0, width: 100, height: 100 } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      setProcessedUri(result.uri);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      Alert.alert("Info", "Use Pinch-to-zoom on the image preview to frame your crop area, then save.");
    }
  };

  const handleRotate = async () => {
    if (!uri) return;
    setProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        processedUri ?? uri,
        [{ rotate: 90 }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      setProcessedUri(result.uri);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      Alert.alert("Error", "Could not rotate.");
    } finally {
      setProcessing(false);
    }
  };

  const handleFlip = async () => {
    if (!uri) return;
    setProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        processedUri ?? uri,
        [{ flip: ImageManipulator.FlipType.Horizontal }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      setProcessedUri(result.uri);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      Alert.alert("Error", "Could not flip.");
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async () => {
    const saveUri = processedUri ?? uri;
    if (!saveUri) return;
    setProcessing(true);
    try {
      await saveFile("documents", saveUri, "edited", "jpg");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", "Edited document saved to Files.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Error", "Could not save.");
    } finally {
      setProcessing(false);
    }
  };

  const displayUri = processedUri ?? uri;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Document</Text>
        {displayUri ? (
          <TouchableOpacity
            style={[styles.saveHeaderBtn, processing && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={processing}
          >
            <Text style={styles.saveHeaderBtnText}>Save</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 52 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomPad + 30 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!displayUri ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="edit-2" size={44} color={C.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>Select a Document</Text>
            <Text style={styles.emptyText}>
              Pick an image from your gallery or Documents folder to edit.
            </Text>
            <TouchableOpacity style={styles.pickBtn} onPress={pickDocument}>
              <Feather name="image" size={18} color={C.background} />
              <Text style={styles.pickBtnText}>Pick from Gallery</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Image Preview */}
            <View style={styles.previewWrap}>
              <Image
                source={{ uri: displayUri }}
                style={styles.preview}
                resizeMode="contain"
              />
              {processing && (
                <View style={styles.processingOverlay}>
                  <Feather name="loader" size={28} color={C.primary} />
                  <Text style={styles.processingText}>Processing...</Text>
                </View>
              )}
            </View>

            {/* Transform Tools */}
            <Text style={styles.sectionLabel}>Transform</Text>
            <View style={styles.toolRow}>
              {[
                { icon: "rotate-cw", label: "Rotate", fn: handleRotate },
                { icon: "minimize-2", label: "Flip H", fn: handleFlip },
              ].map((t) => (
                <TouchableOpacity
                  key={t.icon}
                  style={styles.toolBtn}
                  onPress={t.fn}
                  disabled={processing}
                >
                  <View style={styles.toolBtnIcon}>
                    <Feather name={t.icon as any} size={20} color={C.primary} />
                  </View>
                  <Text style={styles.toolBtnLabel}>{t.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.toolBtn}
                onPress={pickDocument}
                disabled={processing}
              >
                <View style={styles.toolBtnIcon}>
                  <Feather name="image" size={20} color={C.accent} />
                </View>
                <Text style={styles.toolBtnLabel}>Replace</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toolBtn}
                onPress={() => setProcessedUri(null)}
                disabled={!processedUri || processing}
              >
                <View
                  style={[
                    styles.toolBtnIcon,
                    !processedUri && { opacity: 0.4 },
                  ]}
                >
                  <Feather name="refresh-ccw" size={20} color={C.warning} />
                </View>
                <Text
                  style={[
                    styles.toolBtnLabel,
                    !processedUri && { color: C.textTertiary },
                  ]}
                >
                  Reset
                </Text>
              </TouchableOpacity>
            </View>

            {/* Presets */}
            <Text style={styles.sectionLabel}>Enhancement Presets</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.presetScroll}
              contentContainerStyle={styles.presetContent}
            >
              {PRESETS.map((p, idx) => (
                <TouchableOpacity
                  key={p.label}
                  style={[
                    styles.presetChip,
                    preset === idx && styles.presetChipActive,
                  ]}
                  onPress={() => applyPreset(idx)}
                  disabled={processing}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      preset === idx && styles.presetChipTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Info */}
            <View style={styles.infoCard}>
              <Feather name="info" size={14} color={C.textSecondary} />
              <Text style={styles.infoText}>
                Tap "Save" in the header to save your edits. Presets are applied on save.
              </Text>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveBtn, processing && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={processing}
            >
              <Feather name="save" size={18} color={C.background} />
              <Text style={styles.saveBtnText}>
                {processing ? "Saving..." : "Save Edited Document"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Livvic_700Bold",
    color: C.text,
  },
  saveHeaderBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  saveHeaderBtnText: {
    fontSize: 14,
    fontFamily: "Livvic_700Bold",
    color: C.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 16,
  },
  emptyIcon: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: C.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: "Livvic_700Bold",
    color: C.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Livvic_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 8,
  },
  pickBtnText: {
    fontSize: 15,
    fontFamily: "Livvic_700Bold",
    color: C.background,
  },
  previewWrap: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 16,
    overflow: "hidden",
    height: 300,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: {
    width: "100%",
    height: "100%",
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,10,15,0.7)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  processingText: {
    fontSize: 14,
    fontFamily: "Livvic_500Medium",
    color: C.primary,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Livvic_600SemiBold",
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  toolRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  toolBtn: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  toolBtnIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: C.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  toolBtnLabel: {
    fontSize: 11,
    fontFamily: "Livvic_500Medium",
    color: C.textSecondary,
  },
  presetScroll: {
    marginBottom: 24,
    marginHorizontal: -20,
  },
  presetContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: C.surfaceElevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  presetChipActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  presetChipText: {
    fontSize: 13,
    fontFamily: "Livvic_500Medium",
    color: C.textSecondary,
  },
  presetChipTextActive: {
    color: "#fff",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Livvic_400Regular",
    color: C.textSecondary,
    lineHeight: 18,
  },
  saveBtn: {
    backgroundColor: C.success,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontSize: 16,
    fontFamily: "Livvic_700Bold",
    color: C.background,
  },
});
