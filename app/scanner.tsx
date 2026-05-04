import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import Colors from "@/constants/colors";

const C = Colors.light;

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const scanCooldown = useRef(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scanCooldown.current || scanned) return;
    scanCooldown.current = true;
    setScanned(true);
    setScanResult(result.data);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => { scanCooldown.current = false; }, 2000);
  };

  const handleCopy = async () => {
    if (!scanResult) return;
    await Clipboard.setStringAsync(scanResult);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Copied!", "QR code content copied to clipboard.");
  };

  const handleOpen = async () => {
    if (!scanResult) return;
    const isUrl = scanResult.startsWith("http://") || scanResult.startsWith("https://");
    if (isUrl) {
      await Linking.openURL(scanResult);
    } else {
      Alert.alert("Not a URL", "This QR code contains text, not a link.");
    }
  };

  const handleScanAgain = () => {
    setScanned(false);
    setScanResult(null);
    scanCooldown.current = false;
  };

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.permCenter, { paddingTop: topPad + 20 }]}>
          <Feather name="loader" size={40} color={C.textSecondary} />
          <Text style={styles.permText}>Checking camera permission...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.permCenter, { paddingTop: topPad + 20 }]}>
          <View style={styles.permIcon}>
            <Feather name="camera-off" size={40} color={C.textSecondary} />
          </View>
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permText}>
            UltraScan needs camera access to scan QR codes.
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.permBtn, styles.permBtnSecondary]}
            onPress={() => router.back()}
          >
            <Text style={styles.permBtnTextSecondary}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      {/* Camera */}
      {!scanned && (
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ["qr", "pdf417", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e", "aztec", "datamatrix"] }}
          onBarcodeScanned={handleBarCodeScanned}
          enableTorch={flashOn}
        />
      )}

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: topPad + 10 }]}>
          <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>QR Scanner</Text>
          <TouchableOpacity
            style={[styles.topBtn, flashOn && styles.topBtnActive]}
            onPress={() => setFlashOn(!flashOn)}
          >
            <Feather name={flashOn ? "zap" : "zap-off"} size={22} color={flashOn ? C.background : "#fff"} />
          </TouchableOpacity>
        </View>

        {/* Viewfinder */}
        {!scanned && (
          <View style={styles.viewfinderWrap}>
            <View style={styles.viewfinder}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <View style={styles.scanLine} />
            </View>
            <Text style={styles.scanHint}>Point at a QR code to scan</Text>
          </View>
        )}

        {/* Result */}
        {scanned && scanResult && (
          <View style={styles.resultContainer}>
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <View style={styles.resultSuccess}>
                  <Feather name="check-circle" size={22} color={C.success} />
                  <Text style={styles.resultSuccessText}>Scanned!</Text>
                </View>
              </View>
              <Text style={styles.resultLabel}>Content</Text>
              <Text style={styles.resultContent} numberOfLines={6} selectable>
                {scanResult}
              </Text>
              <View style={styles.resultActions}>
                <TouchableOpacity style={styles.resultBtn} onPress={handleCopy}>
                  <Feather name="copy" size={18} color={C.text} />
                  <Text style={styles.resultBtnText}>Copy</Text>
                </TouchableOpacity>
                {(scanResult.startsWith("http") ) && (
                  <TouchableOpacity style={styles.resultBtn} onPress={handleOpen}>
                    <Feather name="external-link" size={18} color={C.text} />
                    <Text style={styles.resultBtnText}>Open</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.scanAgainBtn}
                onPress={handleScanAgain}
              >
                <Feather name="refresh-cw" size={18} color={C.background} />
                <Text style={styles.scanAgainText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {!scanned && (
        <View style={[styles.bottomHint, { paddingBottom: bottomPad + 20 }]}>
          <Text style={styles.bottomHintText}>Supports QR, Barcodes, Data Matrix & more</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
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
  topBtnActive: {
    backgroundColor: C.primary,
  },
  topTitle: {
    fontSize: 17,
    fontFamily: "Livvic_600SemiBold",
    color: "#fff",
  },
  viewfinderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  viewfinder: {
    width: 240,
    height: 240,
    position: "relative",
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: C.primary,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 2,
    backgroundColor: C.primary,
    opacity: 0.8,
  },
  scanHint: {
    marginTop: 24,
    fontSize: 14,
    fontFamily: "Livvic_400Regular",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  resultContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  resultCard: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    borderWidth: 1,
    borderColor: C.border,
  },
  resultHeader: {
    marginBottom: 16,
  },
  resultSuccess: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultSuccessText: {
    fontSize: 18,
    fontFamily: "Livvic_700Bold",
    color: C.success,
  },
  resultLabel: {
    fontSize: 11,
    fontFamily: "Livvic_600SemiBold",
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  resultContent: {
    fontSize: 15,
    fontFamily: "Livvic_400Regular",
    color: C.text,
    lineHeight: 22,
    marginBottom: 20,
    backgroundColor: C.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  resultActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  resultBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  resultBtnText: {
    fontSize: 14,
    fontFamily: "Livvic_600SemiBold",
    color: C.text,
  },
  scanAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  scanAgainText: {
    fontSize: 15,
    fontFamily: "Livvic_700Bold",
    color: C.background,
  },
  bottomHint: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingTop: 16,
  },
  bottomHintText: {
    fontSize: 12,
    fontFamily: "Livvic_400Regular",
    color: "rgba(255,255,255,0.5)",
  },
  permCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
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
    fontSize: 15,
    fontFamily: "Livvic_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  permBtn: {
    backgroundColor: C.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
  },
  permBtnSecondary: {
    backgroundColor: C.surfaceElevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  permBtnText: {
    fontSize: 15,
    fontFamily: "Livvic_700Bold",
    color: C.background,
  },
  permBtnTextSecondary: {
    fontSize: 15,
    fontFamily: "Livvic_600SemiBold",
    color: C.text,
  },
});
