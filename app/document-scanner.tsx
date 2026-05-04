import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { saveFile } from "@/lib/fileStore";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import Colors from "@/constants/colors";

const C = Colors.light;

export default function DocumentScannerScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92 });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
      }
    } catch (e) {
      Alert.alert("Error", "Could not capture photo. Please try again.");
    }
  };

  const handlePickFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.92,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        setCapturedUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert("Error", "Could not pick image.");
    }
  };

  const handleSave = async () => {
    if (!capturedUri) return;
    setSaving(true);
    try {
      const dest = await saveFile("documents", capturedUri, "scan", "jpg");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Saved!",
        "Document saved to your Files.",
        [
          {
            text: "Edit Document",
            onPress: () => {
              router.replace({ pathname: "/edit-document", params: { uri: dest } } as any);
            },
          },
          {
            text: "Scan Another",
            onPress: () => setCapturedUri(null),
          },
        ]
      );
    } catch (e) {
      Alert.alert("Error", "Could not save document.");
    } finally {
      setSaving(false);
    }
  };

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={styles.center}>
          <Feather name="loader" size={32} color={C.textSecondary} />
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.permCenter, { paddingTop: topPad }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={C.text} />
          </TouchableOpacity>
          <View style={styles.permContent}>
            <View style={styles.permIcon}>
              <Feather name="camera-off" size={40} color={C.textSecondary} />
            </View>
            <Text style={styles.permTitle}>Camera Access Required</Text>
            <Text style={styles.permText}>
              Allow camera access to scan and capture documents.
            </Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.permBtn, styles.permBtnAlt]}
              onPress={handlePickFromLibrary}
            >
              <Feather name="image" size={18} color={C.text} />
              <Text style={styles.permBtnTextAlt}>Pick from Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      {!capturedUri ? (
        <>
          {/* Camera View */}
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} />

          {/* Overlay */}
          <View style={styles.overlay}>
            {/* Top Bar */}
            <View style={[styles.topBar, { paddingTop: topPad + 10 }]}>
              <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
                <Feather name="x" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.topTitle}>Document Scanner</Text>
              <TouchableOpacity style={styles.topBtn} onPress={handlePickFromLibrary}>
                <Feather name="image" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Document Frame */}
            <View style={styles.docFrameWrap}>
              <View style={styles.docFrame}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <Text style={styles.frameHint}>Position document within frame</Text>
            </View>

            {/* Bottom Controls */}
            <View
              style={[
                styles.bottomControls,
                { paddingBottom: bottomPad + 24 },
              ]}
            >
              <TouchableOpacity style={styles.galleryBtn} onPress={handlePickFromLibrary}>
                <Feather name="image" size={22} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.captureBtn}
                onPress={handleCapture}
                activeOpacity={0.8}
              >
                <View style={styles.captureBtnInner} />
              </TouchableOpacity>

              <View style={{ width: 52 }} />
            </View>
          </View>
        </>
      ) : (
        /* Preview */
        <View style={[styles.previewContainer, { backgroundColor: C.background }]}>
          <View style={[styles.previewHeader, { paddingTop: topPad + 10 }]}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setCapturedUri(null)}
            >
              <Feather name="arrow-left" size={20} color={C.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Preview</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.previewImageWrap}>
            <Image
              source={{ uri: capturedUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          </View>

          <View style={[styles.previewActions, { paddingBottom: bottomPad + 24 }]}>
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={() => setCapturedUri(null)}
            >
              <Feather name="refresh-ccw" size={18} color={C.text} />
              <Text style={styles.retakeBtnText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnLoading]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Feather name="loader" size={18} color={C.background} />
              ) : (
                <Feather name="save" size={18} color={C.background} />
              )}
              <Text style={styles.saveBtnText}>
                {saving ? "Saving..." : "Save Document"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  overlay: { ...StyleSheet.absoluteFillObject },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontSize: 17,
    fontFamily: "Livvic_600SemiBold",
    color: "#fff",
  },
  docFrameWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  docFrame: {
    width: 280,
    height: 360,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: C.success,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  frameHint: {
    marginTop: 20,
    fontSize: 13,
    fontFamily: "Livvic_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  bottomControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 40,
    paddingTop: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  galleryBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  captureBtnInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
  },
  previewContainer: { flex: 1 },
  previewHeader: {
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
  previewImageWrap: {
    flex: 1,
    margin: 20,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: C.surfaceElevated,
  },
  previewImage: { flex: 1, width: "100%" },
  previewActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: C.border,
  },
  retakeBtnText: {
    fontSize: 15,
    fontFamily: "Livvic_600SemiBold",
    color: C.text,
  },
  saveBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.success,
    borderRadius: 14,
    paddingVertical: 15,
  },
  saveBtnLoading: { opacity: 0.7 },
  saveBtnText: {
    fontSize: 15,
    fontFamily: "Livvic_700Bold",
    color: C.background,
  },
  permCenter: { flex: 1, paddingHorizontal: 20 },
  permContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  permIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  permTitle: {
    fontSize: 22,
    fontFamily: "Livvic_700Bold",
    color: C.text,
    textAlign: "center",
  },
  permText: {
    fontSize: 14,
    fontFamily: "Livvic_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  permBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
  },
  permBtnAlt: {
    backgroundColor: C.surfaceElevated,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: "row",
    gap: 8,
  },
  permBtnText: {
    fontSize: 15,
    fontFamily: "Livvic_700Bold",
    color: C.background,
  },
  permBtnTextAlt: {
    fontSize: 15,
    fontFamily: "Livvic_600SemiBold",
    color: C.text,
  },
});
