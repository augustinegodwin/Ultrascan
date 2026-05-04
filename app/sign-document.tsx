import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Image,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import ViewShot from "react-native-view-shot";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from "react-native-reanimated";
import {
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";
import Colors from "@/constants/colors";
import { listAllFiles, saveFile, type StoredFile } from "@/lib/fileStore";
import { useFocusEffect } from "expo-router";

const C = Colors.light;

// Web-only: draw doc + signature overlay onto an HTML canvas and export as JPEG data URL
async function loadImg(uri: string): Promise<HTMLImageElement> {
  const img: HTMLImageElement = new (window as any).Image();
  img.crossOrigin = "anonymous";
  img.src = uri;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
  });
  return img;
}

async function compositeOnCanvas(opts: {
  docUri: string;
  sigUri: string;
  tx: number;
  ty: number;
  sc: number;
  sigW: number;
  sigH: number;
  cW: number;
  cH: number;
}): Promise<string> {
  const { docUri, sigUri, tx, ty, sc, sigW, sigH, cW, cH } = opts;
  const canvas = document.createElement("canvas");
  canvas.width = cW;
  canvas.height = cH;
  const ctx = canvas.getContext("2d")!;

  // Draw document background
  const docImg = await loadImg(docUri);
  // Fit doc image into canvas (same as resizeMode="contain")
  const docRatio = docImg.naturalWidth / docImg.naturalHeight;
  const canvasRatio = cW / cH;
  let dw = cW, dh = cH, dx = 0, dy = 0;
  if (docRatio > canvasRatio) {
    dh = cW / docRatio;
    dy = (cH - dh) / 2;
  } else {
    dw = cH * docRatio;
    dx = (cW - dw) / 2;
  }
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, 0, cW, cH);
  ctx.drawImage(docImg, dx, dy, dw, dh);

  // Draw signature overlay with current transform
  // Base position: top 35% left 25% of canvas
  const baseX = cW * 0.25;
  const baseY = cH * 0.35;
  const finalW = sigW * sc;
  const finalH = sigH * sc;
  const finalX = baseX + tx;
  const finalY = baseY + ty;

  const sigImg = await loadImg(sigUri);
  ctx.drawImage(sigImg, finalX, finalY, finalW, finalH);

  return canvas.toDataURL("image/jpeg", 0.95);
}

export default function SignDocumentScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const params = useLocalSearchParams<{ signatureUri?: string; docUri?: string }>();

  // Document state
  const [docUri, setDocUri] = useState<string | null>(params.docUri ?? null);
  // Signature state
  const [sigUri, setSigUri] = useState<string | null>(params.signatureUri ?? null);
  // Saved signatures for picker
  const [savedSigs, setSavedSigs] = useState<StoredFile[]>([]);
  const [showSigPicker, setShowSigPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const viewShotRef = useRef<ViewShot>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Gesture values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const [sigSize, setSigSize] = useState({ w: 180, h: 90 });

  useFocusEffect(
    useCallback(() => {
      listAllFiles().then((files) => {
        setSavedSigs(files.filter((f) => f.type === "signatures"));
      });
    }, [])
  );

  const resetPosition = () => {
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
    savedScale.value = 1;
    savedX.value = 0;
    savedY.value = 0;
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.3, Math.min(4, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  const sigStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const pickDocument = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (!result.canceled && result.assets[0]) {
        setDocUri(result.assets[0].uri);
        resetPosition();
      }
    } catch {
      Alert.alert("Error", "Could not open photo library.");
    }
  };

  const pickSignature = async (sig: StoredFile) => {
    setSigUri(sig.uri);
    setShowSigPicker(false);
    resetPosition();
    await Haptics.selectionAsync();
  };

  const handleSave = async () => {
    if (!docUri || !sigUri) return;
    setSaving(true);
    try {
      let uri: string;

      if (Platform.OS === "web") {
        uri = await compositeOnCanvas({
          docUri,
          sigUri,
          tx: translateX.value,
          ty: translateY.value,
          sc: scale.value,
          sigW: sigSize.w,
          sigH: sigSize.h,
          cW: containerSize.w || 360,
          cH: containerSize.h || 600,
        });
      } else {
        uri = await (viewShotRef.current as any).capture();
      }

      const dest = await saveFile("documents", uri, "signed", "jpg");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", "Signed document saved to Files.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not save document.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Sign Document</Text>
        {docUri && sigUri ? (
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 64 }} />
        )}
      </View>

      {/* No document yet */}
      {!docUri ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="file-text" size={44} color={C.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>Pick a Document</Text>
          <Text style={styles.emptyText}>
            Choose the image or document you want to sign.
          </Text>
          <TouchableOpacity style={styles.pickDocBtn} onPress={pickDocument}>
            <Feather name="image" size={18} color="#fff" />
            <Text style={styles.pickDocBtnText}>Choose from Library</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Document canvas */}
          <View style={styles.canvasWrapper}>
            {(() => {
              const content = (
                <View
                  style={styles.viewShot}
                  onLayout={(e) =>
                    setContainerSize({
                      w: Math.round(e.nativeEvent.layout.width),
                      h: Math.round(e.nativeEvent.layout.height),
                    })
                  }
                >
                  <Image
                    source={{ uri: docUri }}
                    style={styles.docImage}
                    resizeMode="contain"
                  />
                  {sigUri && (
                    <GestureDetector gesture={composed}>
                      <Animated.View
                        style={[
                          styles.sigOverlay,
                          { width: sigSize.w, height: sigSize.h },
                          sigStyle,
                        ]}
                      >
                        <Image
                          source={{ uri: sigUri }}
                          style={styles.sigImage}
                          resizeMode="contain"
                          onLoad={(e) => {
                            const source = (e.nativeEvent as any)?.source;
                            if (!source?.width) return;
                            const ratio = source.height / source.width;
                            setSigSize({ w: 200, h: Math.round(200 * ratio) });
                          }}
                        />
                      </Animated.View>
                    </GestureDetector>
                  )}
                </View>
              );

              if (Platform.OS === "web") return content;

              return (
                <ViewShot
                  ref={viewShotRef}
                  style={{ flex: 1 }}
                  options={{ format: "jpg", quality: 0.95 }}
                >
                  {content}
                </ViewShot>
              );
            })()}
          </View>

          {/* Bottom toolbar */}
          <View style={[styles.toolbar, { paddingBottom: bottomPad + 8 }]}>
            <TouchableOpacity style={styles.toolBtn} onPress={pickDocument}>
              <Feather name="image" size={20} color={C.text} />
              <Text style={styles.toolLabel}>Change Doc</Text>
            </TouchableOpacity>
            <View style={styles.toolDivider} />
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => {
                listAllFiles().then((files) => {
                  setSavedSigs(files.filter((f) => f.type === "signatures"));
                  setShowSigPicker(true);
                });
              }}
            >
              <Feather name="pen-tool" size={20} color={C.primary} />
              <Text style={[styles.toolLabel, { color: C.primary }]}>
                {sigUri ? "Change Sig" : "Pick Signature"}
              </Text>
            </TouchableOpacity>
            {sigUri && (
              <>
                <View style={styles.toolDivider} />
                <TouchableOpacity
                  style={styles.toolBtn}
                  onPress={() => {
                    resetPosition();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Feather name="refresh-cw" size={20} color={C.textSecondary} />
                  <Text style={styles.toolLabel}>Reset</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </>
      )}

      {/* Signature Picker Modal */}
      <Modal
        visible={showSigPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSigPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a Signature</Text>
              <TouchableOpacity
                onPress={() => setShowSigPicker(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={22} color={C.text} />
              </TouchableOpacity>
            </View>

            {savedSigs.length === 0 ? (
              <View style={styles.noSigs}>
                <Feather name="pen-tool" size={32} color={C.textTertiary} />
                <Text style={styles.noSigsText}>No saved signatures yet.</Text>
                <TouchableOpacity
                  style={styles.drawNewBtn}
                  onPress={() => {
                    setShowSigPicker(false);
                    router.push("/signature" as any);
                  }}
                >
                  <Text style={styles.drawNewBtnText}>Draw a Signature</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sigScrollRow}
              >
                {savedSigs.map((sig) => (
                  <TouchableOpacity
                    key={sig.uri}
                    style={[
                      styles.sigThumb,
                      sig.uri === sigUri && styles.sigThumbActive,
                    ]}
                    onPress={() => pickSignature(sig)}
                    activeOpacity={0.75}
                  >
                    <Image
                      source={{ uri: sig.uri }}
                      style={styles.sigThumbImage}
                      resizeMode="contain"
                    />
                    {sig.uri === sigUri && (
                      <View style={styles.sigCheckBadge}>
                        <Feather name="check" size={12} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.drawNewThumb}
                  onPress={() => {
                    setShowSigPicker(false);
                    router.push("/signature" as any);
                  }}
                >
                  <Feather name="plus" size={24} color={C.primary} />
                  <Text style={styles.drawNewThumbText}>New</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontFamily: "Livvic_700Bold",
    color: C.text,
  },
  saveBtn: {
    backgroundColor: C.primary,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Livvic_600SemiBold",
  },

  /* Empty state */
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 14,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
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
  },
  pickDocBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    marginTop: 8,
  },
  pickDocBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Livvic_600SemiBold",
  },

  /* Canvas */
  canvasWrapper: {
    flex: 1,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  viewShot: {
    flex: 1,
    position: "relative",
  },
  docImage: {
    flex: 1,
    width: "100%",
  },
  sigOverlay: {
    position: "absolute",
    top: "35%",
    left: "25%",
  },
  sigImage: {
    width: "100%",
    height: "100%",
  },

  /* Bottom toolbar */
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 0,
  },
  toolBtn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  toolLabel: {
    fontSize: 11,
    fontFamily: "Livvic_500Medium",
    color: C.textSecondary,
  },
  toolDivider: {
    width: 1,
    height: 36,
    backgroundColor: C.border,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Livvic_700Bold",
    color: C.text,
  },
  noSigs: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  noSigsText: {
    fontSize: 15,
    fontFamily: "Livvic_400Regular",
    color: C.textSecondary,
  },
  drawNewBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  drawNewBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Livvic_600SemiBold",
  },
  sigScrollRow: {
    paddingHorizontal: 20,
    gap: 12,
    alignItems: "center",
  },
  sigThumb: {
    width: 140,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
    position: "relative",
  },
  sigThumbActive: {
    borderColor: C.primary,
  },
  sigThumbImage: {
    width: "100%",
    height: "100%",
  },
  sigCheckBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  drawNewThumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 2,
    borderColor: C.primary,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  drawNewThumbText: {
    fontSize: 12,
    fontFamily: "Livvic_600SemiBold",
    color: C.primary,
  },
});
