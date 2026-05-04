import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { saveFile } from "@/lib/fileStore";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import {
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";
import { Svg, Path } from "react-native-svg";
import { runOnJS } from "react-native-reanimated";
import Colors from "@/constants/colors";

const C = Colors.light;

type Point = { x: number; y: number };
type Stroke = { d: string; color: string; size: number };

const PEN_COLORS = ["#111827", "#0099CC", "#10B981", "#F59E0B", "#EF4444", "#7C3AED"];
const PEN_SIZES = [2, 3, 5, 8];

function buildPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)} L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`;
  }
  d += ` L ${points[points.length - 1].x.toFixed(2)} ${points[points.length - 1].y.toFixed(2)}`;
  return d;
}

// Web-only: renders strokes to a transparent PNG data URL via HTML canvas
async function strokesToPng(strokes: Stroke[], w: number, h: number): Promise<string> {
  const pathEls = strokes
    .map(
      (s) =>
        `<path d="${s.d}" stroke="${s.color}" stroke-width="${s.size}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    )
    .join("");
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${pathEls}</svg>`;
  const blob = new Blob([svgStr], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const img: HTMLImageElement = new (window as any).Image();
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
  });
  const canvas = document.createElement("canvas");
  canvas.width = w || 400;
  canvas.height = h || 220;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/png");
}

// ─── Drawing canvas sub-component ────────────────────────────────────────────
// Extracted as a named component so the React Compiler handles it correctly.

type CanvasProps = {
  strokes: Stroke[];
  activePath: string;
  penColor: string;
  penSize: number;
  isEmpty: boolean;
  onLayout: (e: any) => void;
  // native gesture
  pan: ReturnType<typeof Gesture.Pan>;
  // web responders
  onStart: (x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onEnd: () => void;
};

function DrawingCanvas({ strokes, activePath, penColor, penSize, isEmpty, onLayout, pan, onStart, onMove, onEnd }: CanvasProps) {
  const svgPaths = (
    <Svg width="100%" height="100%">
      {strokes.map((s, idx) => (
        <Path
          key={idx}
          d={s.d}
          stroke={s.color}
          strokeWidth={s.size}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {activePath !== "" && (
        <Path
          d={activePath}
          stroke={penColor}
          strokeWidth={penSize}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );

  const hint = isEmpty ? (
    <View style={styles.signLineHintWrap} pointerEvents="none">
      <View style={styles.signLine} />
      <Text style={styles.signLineLabel}>Sign here</Text>
    </View>
  ) : null;

  if (Platform.OS === "web") {
    return (
      <View
        style={styles.canvasInner}
        collapsable={false}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => onStart(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        onResponderMove={(e) => onMove(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        onResponderRelease={() => onEnd()}
        onResponderTerminate={() => onEnd()}
      >
        {svgPaths}
        {hint}
      </View>
    );
  }

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.canvasInner} collapsable={false} onLayout={onLayout}>
        {svgPaths}
        {hint}
      </View>
    </GestureDetector>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SignatureScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const viewShotRef = useRef<ViewShot>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activePath, setActivePath] = useState<string>("");
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [penSize, setPenSize] = useState(PEN_SIZES[1]);
  const [saving, setSaving] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 360, h: 220 });

  const activePointsRef = useRef<Point[]>([]);

  const onStrokeStart = useCallback((x: number, y: number) => {
    activePointsRef.current = [{ x, y }];
    setActivePath(buildPath(activePointsRef.current));
  }, []);

  const onStrokeMove = useCallback((x: number, y: number) => {
    const pts = activePointsRef.current;
    const last = pts[pts.length - 1];
    if (last && Math.abs(last.x - x) < 1 && Math.abs(last.y - y) < 1) return;
    pts.push({ x, y });
    setActivePath(buildPath(pts));
  }, []);

  const onStrokeEnd = useCallback(() => {
    const pts = activePointsRef.current;
    if (pts.length === 0) return;
    setStrokes((prev) => [...prev, { d: buildPath(pts), color: penColor, size: penSize }]);
    activePointsRef.current = [];
    setActivePath("");
  }, [penColor, penSize]);

  const pan = Gesture.Pan()
    .minDistance(0)
    .averageTouches(false)
    .onBegin((e) => { runOnJS(onStrokeStart)(e.x, e.y); })
    .onUpdate((e) => { runOnJS(onStrokeMove)(e.x, e.y); })
    .onFinalize(() => { runOnJS(onStrokeEnd)(); });

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStrokes([]);
    setActivePath("");
    activePointsRef.current = [];
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStrokes((s) => s.slice(0, -1));
  };

  const handleSave = async () => {
    if (strokes.length === 0) {
      Alert.alert("Empty", "Please draw your signature first.");
      return;
    }
    setSaving(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      let uri: string;
      if (Platform.OS === "web") {
        uri = await strokesToPng(strokes, canvasSize.w, canvasSize.h);
      } else {
        const captured = await viewShotRef.current?.capture?.();
        if (!captured) throw new Error("capture failed");
        uri = captured;
      }

      const dest = await saveFile("signatures", uri, "sig", "png");

      if (Platform.OS !== "web") {
        try {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status === "granted") await MediaLibrary.saveToLibraryAsync(dest);
        } catch {}
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Signature Saved!", "What would you like to do?", [
        {
          text: "Place on Document",
          onPress: () =>
            router.replace({
              pathname: "/sign-document",
              params: { signatureUri: dest },
            } as any),
        },
        { text: "Share", onPress: () => Sharing.shareAsync(dest).catch(() => {}) },
        { text: "Done" },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not save signature.");
    } finally {
      setSaving(false);
    }
  };

  const isEmpty = strokes.length === 0 && activePath === "";

  const handleLayout = useCallback((e: any) => {
    setCanvasSize({
      w: Math.round(e.nativeEvent.layout.width),
      h: Math.round(e.nativeEvent.layout.height),
    });
  }, []);

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
        <Text style={styles.headerTitle}>Add Signature</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleUndo}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={strokes.length === 0}
        >
          <Feather name="rotate-ccw" size={20} color={strokes.length === 0 ? C.textTertiary : C.text} />
        </TouchableOpacity>
      </View>

      {/* Hint */}
      <View style={styles.hintWrap}>
        <View style={styles.hintPill}>
          <Feather name="edit-3" size={14} color={C.textSecondary} />
          <Text style={styles.hintText}>Draw your signature below</Text>
        </View>
      </View>

      {/* Canvas area */}
      <View style={styles.canvasWrap}>
        <View style={styles.canvasCard}>
          {Platform.OS === "web" ? (
            <DrawingCanvas
              strokes={strokes}
              activePath={activePath}
              penColor={penColor}
              penSize={penSize}
              isEmpty={isEmpty}
              onLayout={handleLayout}
              pan={pan}
              onStart={onStrokeStart}
              onMove={onStrokeMove}
              onEnd={onStrokeEnd}
            />
          ) : (
            <ViewShot
              ref={viewShotRef}
              options={{ format: "png", quality: 1, result: "tmpfile" }}
              style={styles.viewShotNative}
            >
              <DrawingCanvas
                strokes={strokes}
                activePath={activePath}
                penColor={penColor}
                penSize={penSize}
                isEmpty={isEmpty}
                onLayout={handleLayout}
                pan={pan}
                onStart={onStrokeStart}
                onMove={onStrokeMove}
                onEnd={onStrokeEnd}
              />
            </ViewShot>
          )}
        </View>
      </View>

      {/* Pen controls */}
      <View style={styles.controlsRow}>
        <View style={styles.controlGroup}>
          {PEN_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorDot, { backgroundColor: c }, penColor === c && styles.colorDotActive]}
              onPress={() => { Haptics.selectionAsync(); setPenColor(c); }}
            />
          ))}
        </View>
        <View style={styles.controlDivider} />
        <View style={styles.controlGroup}>
          {PEN_SIZES.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.sizeBtn, penSize === s && styles.sizeBtnActive]}
              onPress={() => { Haptics.selectionAsync(); setPenSize(s); }}
            >
              <View style={{ width: s + 4, height: s + 4, borderRadius: (s + 4) / 2, backgroundColor: penSize === s ? "#fff" : C.text }} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Action bar */}
      <View style={[styles.actionBar, { paddingBottom: bottomPad + 16 }]}>
        <TouchableOpacity style={styles.clearBtn} activeOpacity={0.85} onPress={handleClear}>
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, (isEmpty || saving) && styles.saveBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={isEmpty || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
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
    paddingBottom: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Livvic_700Bold", color: C.text },

  hintWrap: { alignItems: "center", paddingTop: 4, paddingBottom: 14 },
  hintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hintText: { fontSize: 13, fontFamily: "Livvic_500Medium", color: C.textSecondary },

  canvasWrap: { flex: 1, paddingHorizontal: 20 },
  canvasCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  // ViewShot on native: transparent so only ink is captured
  viewShotNative: { flex: 1, backgroundColor: "transparent" },

  canvasInner: { flex: 1, backgroundColor: "transparent" },
  signLineHintWrap: { position: "absolute", left: 24, right: 24, bottom: 40, alignItems: "center" },
  signLine: { height: 1, backgroundColor: C.border, width: "100%", marginBottom: 8 },
  signLineLabel: { fontSize: 12, fontFamily: "Livvic_400Regular", color: C.textTertiary },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  controlGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  controlDivider: { width: 1, height: 22, backgroundColor: C.border, marginHorizontal: 4 },
  colorDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: "transparent" },
  colorDotActive: { borderColor: C.primary, transform: [{ scale: 1.1 }] },
  sizeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6" },
  sizeBtnActive: { backgroundColor: C.primary },

  actionBar: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  clearBtn: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: { fontSize: 16, fontFamily: "Livvic_600SemiBold", color: C.text },
  saveBtn: {
    flex: 1.6,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: { backgroundColor: "#9CA3AF" },
  saveBtnText: { fontSize: 16, fontFamily: "Livvic_700Bold", color: "#fff" },
});
