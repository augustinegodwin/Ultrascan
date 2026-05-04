import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  TextInput,
  Platform,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { saveFile } from "@/lib/fileStore";
import * as MediaLibrary from "expo-media-library";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import Colors from "@/constants/colors";

const C = Colors.light;

type WatermarkType = "text" | "logo";

const PAGE_PREVIEW_HEIGHT = 520;

export default function WatermarkScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const viewShotRef = useRef<ViewShot>(null);

  const [docUri, setDocUri] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<WatermarkType>("text");

  // Draft fields used inside the sheet
  const [draftText, setDraftText] = useState("Andrew Ainsley");
  const [draftLogoUri, setDraftLogoUri] = useState<string | null>(null);

  // Applied watermark
  const [appliedType, setAppliedType] = useState<WatermarkType | null>(null);
  const [appliedText, setAppliedText] = useState<string>("");
  const [appliedLogoUri, setAppliedLogoUri] = useState<string | null>(null);

  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [saving, setSaving] = useState(false);

  const pickDocument = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setDocUri(result.assets[0].uri);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Open sheet automatically after picking
      setTimeout(() => setSheetOpen(true), 250);
    }
  };

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setDraftLogoUri(result.assets[0].uri);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const openSheet = () => {
    if (appliedType === "text") setDraftText(appliedText);
    if (appliedType === "logo") setDraftLogoUri(appliedLogoUri);
    setTab(appliedType ?? "text");
    setSheetOpen(true);
  };

  const handleContinue = async () => {
    if (tab === "text") {
      if (!draftText.trim()) {
        Alert.alert("Empty", "Please enter watermark text.");
        return;
      }
      setAppliedType("text");
      setAppliedText(draftText.trim());
    } else {
      if (!draftLogoUri) {
        Alert.alert("No logo", "Please choose a logo image.");
        return;
      }
      setAppliedType("logo");
      setAppliedLogoUri(draftLogoUri);
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSheetOpen(false);
  };

  const handleSave = async () => {
    if (!docUri || !appliedType || !viewShotRef.current) {
      Alert.alert("Nothing to save", "Add a watermark first.");
      return;
    }
    setSaving(true);
    try {
      const uri = await (viewShotRef.current as any).capture();
      const dest = await saveFile("documents", uri, "watermarked", "png");

      if (Platform.OS !== "web") {
        try {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status === "granted") await MediaLibrary.saveToLibraryAsync(dest);
        } catch {}
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "Watermarked document saved to Files.", [
        { text: "Share", onPress: () => Sharing.shareAsync(dest).catch(() => {}) },
        { text: "OK" },
      ]);
    } catch {
      Alert.alert("Error", "Could not save document.");
    } finally {
      setSaving(false);
    }
  };

  const onCanvasLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasSize({ w: width, h: height });
  };

  // Build tiled watermark grid based on canvas size
  const renderTiledWatermark = () => {
    if (!appliedType || canvasSize.w === 0) return null;

    const tileW = appliedType === "text" ? 180 : 120;
    const tileH = appliedType === "text" ? 110 : 110;

    // Make the grid larger than canvas so rotation doesn't leave gaps.
    const overflow = 0.6;
    const startX = -canvasSize.w * overflow;
    const startY = -canvasSize.h * overflow;
    const endX = canvasSize.w * (1 + overflow);
    const endY = canvasSize.h * (1 + overflow);

    const tiles: React.ReactNode[] = [];
    let row = 0;
    for (let y = startY; y < endY; y += tileH) {
      const offsetX = (row % 2) * (tileW / 2);
      for (let x = startX; x < endX; x += tileW) {
        const key = `${x}-${y}`;
        tiles.push(
          <View
            key={key}
            style={{
              position: "absolute",
              left: x + offsetX,
              top: y,
              width: tileW,
              height: tileH,
              alignItems: "center",
              justifyContent: "center",
            }}
            pointerEvents="none"
          >
            {appliedType === "text" ? (
              <Text style={styles.tileText} numberOfLines={1}>
                {appliedText}
              </Text>
            ) : (
              appliedLogoUri && (
                <Image
                  source={{ uri: appliedLogoUri }}
                  style={styles.tileLogo}
                  resizeMode="contain"
                />
              )
            )}
          </View>
        );
      }
      row++;
    }
    return (
      <View style={styles.tileLayer} pointerEvents="none">
        {tiles}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Watermark</Text>
        {docUri && appliedType ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={openSheet}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="edit-2" size={20} color={C.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {/* Body */}
      {!docUri ? (
        <View style={styles.emptyWrap}>
          <TouchableOpacity
            style={styles.pickArea}
            onPress={pickDocument}
            activeOpacity={0.8}
          >
            <View style={styles.pickAreaIcon}>
              <Feather name="image" size={36} color={C.primary} />
            </View>
            <Text style={styles.pickAreaTitle}>Select Document</Text>
            <Text style={styles.pickAreaText}>
              Choose an image to watermark
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.previewScroll}
          showsVerticalScrollIndicator={false}
        >
          <ViewShot
            ref={viewShotRef}
            options={{ format: "png", quality: 1, result: "tmpfile" }}
            style={styles.pageShadow}
          >
            <View style={styles.page} onLayout={onCanvasLayout}>
              <Image
                source={{ uri: docUri }}
                style={styles.pageImage}
                resizeMode="cover"
              />
              {renderTiledWatermark()}
            </View>
          </ViewShot>

          {/* Page indicator */}
          <View style={styles.pagePill}>
            <Text style={styles.pagePillText}>Page 1 of 1</Text>
          </View>

          {!appliedType && (
            <TouchableOpacity
              style={styles.addWatermarkBtn}
              onPress={openSheet}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={16} color={C.primary} />
              <Text style={styles.addWatermarkBtnText}>Add a watermark</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Bottom action bar */}
      {docUri && (
        <View style={[styles.actionBar, { paddingBottom: bottomPad + 16 }]}>
          <TouchableOpacity
            style={styles.cancelBtn}
            activeOpacity={0.85}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              (!appliedType || saving) && styles.saveBtnDisabled,
            ]}
            activeOpacity={0.85}
            onPress={handleSave}
            disabled={!appliedType || saving}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom Sheet Modal */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setSheetOpen(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.sheetWrap}
          >
            <View style={styles.sheet}>
              <View style={styles.sheetGrabber} />
              <Text style={styles.sheetTitle}>Add Watermark</Text>

              {/* Tabs */}
              <View style={styles.tabsRow}>
                <TouchableOpacity
                  style={[styles.tabBtn, tab === "text" && styles.tabBtnActive]}
                  onPress={() => { Haptics.selectionAsync(); setTab("text"); }}
                >
                  <Text
                    style={[styles.tabText, tab === "text" && styles.tabTextActive]}
                  >
                    Watermark Text
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabBtn, tab === "logo" && styles.tabBtnActive]}
                  onPress={() => { Haptics.selectionAsync(); setTab("logo"); }}
                >
                  <Text
                    style={[styles.tabText, tab === "logo" && styles.tabTextActive]}
                  >
                    Watermark Logo
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tab content */}
              {tab === "text" ? (
                <View style={styles.tabContent}>
                  <Text style={styles.fieldLabel}>Your Text</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={draftText}
                    onChangeText={setDraftText}
                    placeholder="e.g. CONFIDENTIAL"
                    placeholderTextColor={C.textTertiary}
                    maxLength={40}
                    autoFocus
                  />
                  <View style={styles.fieldUnderline} />
                </View>
              ) : (
                <View style={styles.tabContent}>
                  <Text style={styles.fieldLabel}>Your Logo</Text>
                  <TouchableOpacity
                    style={styles.logoPicker}
                    onPress={pickLogo}
                    activeOpacity={0.8}
                  >
                    {draftLogoUri ? (
                      <Image
                        source={{ uri: draftLogoUri }}
                        style={styles.logoPreview}
                        resizeMode="contain"
                      />
                    ) : (
                      <>
                        <Feather name="image" size={28} color={C.textSecondary} />
                        <Text style={styles.logoPickerText}>Tap to choose logo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Sheet actions */}
              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={styles.sheetCancelBtn}
                  activeOpacity={0.85}
                  onPress={() => setSheetOpen(false)}
                >
                  <Text style={styles.sheetCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sheetContinueBtn}
                  activeOpacity={0.85}
                  onPress={handleContinue}
                >
                  <Text style={styles.sheetContinueText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: C.background,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Livvic_700Bold",
    color: C.text,
  },

  /* Empty / picker */
  emptyWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  pickArea: {
    height: 280,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: C.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#FAFBFC",
  },
  pickAreaIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#E0F5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  pickAreaTitle: {
    fontSize: 18,
    fontFamily: "Livvic_700Bold",
    color: C.text,
  },
  pickAreaText: {
    fontSize: 13,
    fontFamily: "Livvic_400Regular",
    color: C.textSecondary,
  },

  /* Preview */
  previewScroll: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 24,
    alignItems: "center",
  },
  pageShadow: {
    width: "100%",
    borderRadius: 8,
  },
  page: {
    width: "100%",
    height: PAGE_PREVIEW_HEIGHT,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  pageImage: {
    width: "100%",
    height: "100%",
  },
  tileLayer: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ rotate: "-30deg" }],
  },
  tileText: {
    fontSize: 16,
    fontFamily: "Livvic_500Medium",
    color: "rgba(0,0,0,0.18)",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  tileLogo: {
    width: 70,
    height: 70,
    opacity: 0.18,
  },
  pagePill: {
    backgroundColor: C.text,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 18,
  },
  pagePillText: {
    fontSize: 13,
    fontFamily: "Livvic_600SemiBold",
    color: "#FFFFFF",
  },
  addWatermarkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 18,
    backgroundColor: "#E0F5FF",
    borderRadius: 22,
  },
  addWatermarkBtnText: {
    fontSize: 14,
    fontFamily: "Livvic_600SemiBold",
    color: C.primary,
  },

  /* Action bar */
  actionBar: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.background,
  },
  cancelBtn: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 16,
    fontFamily: "Livvic_600SemiBold",
    color: C.text,
  },
  saveBtn: {
    flex: 1.6,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    backgroundColor: "#9CA3AF",
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: "Livvic_700Bold",
    color: "#fff",
  },

  /* Bottom sheet */
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetWrap: {
    width: "100%",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sheetGrabber: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: "Livvic_700Bold",
    color: C.text,
    textAlign: "center",
    marginBottom: 18,
  },
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 22,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  tabBtnActive: {
    borderBottomColor: C.primary,
  },
  tabText: {
    fontSize: 15,
    fontFamily: "Livvic_500Medium",
    color: C.textSecondary,
  },
  tabTextActive: {
    color: C.primary,
    fontFamily: "Livvic_700Bold",
  },
  tabContent: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Livvic_600SemiBold",
    color: C.text,
    marginBottom: 10,
  },
  fieldInput: {
    fontSize: 18,
    fontFamily: "Livvic_700Bold",
    color: C.text,
    paddingVertical: 8,
  },
  fieldUnderline: {
    height: 1,
    backgroundColor: C.primary,
  },
  logoPicker: {
    height: 140,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: C.border,
    backgroundColor: "#FAFBFC",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    overflow: "hidden",
  },
  logoPickerText: {
    fontSize: 13,
    fontFamily: "Livvic_500Medium",
    color: C.textSecondary,
  },
  logoPreview: {
    width: "90%",
    height: "90%",
  },
  sheetActions: {
    flexDirection: "row",
    gap: 12,
  },
  sheetCancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E0F5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCancelText: {
    fontSize: 16,
    fontFamily: "Livvic_600SemiBold",
    color: C.primary,
  },
  sheetContinueBtn: {
    flex: 1.4,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetContinueText: {
    fontSize: 16,
    fontFamily: "Livvic_700Bold",
    color: "#fff",
  },
});
