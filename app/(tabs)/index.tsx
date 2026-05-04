import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import Colors from "@/constants/colors";
import { listAllFiles } from "@/lib/fileStore";

const C = Colors.light;

type Tool = {
  id: string;
  label: string;
  icon: string;
  route: string;
  iconColor: string;
  bgColor: string;
};

const TOOLS: Tool[] = [
  { id: "qr-scanner",   label: "QR Scanner",   icon: "camera",     route: "/scanner",          iconColor: "#F97316", bgColor: "#FFF3E8" },
  { id: "watermark",    label: "Watermark",     icon: "droplet",    route: "/watermark",        iconColor: "#92400E", bgColor: "#FDF3E3" },
  { id: "signature",    label: "eSign",         icon: "pen-tool",   route: "/sign-document",    iconColor: "#EF4444", bgColor: "#FEF0F0" },
  { id: "doc-scanner",  label: "Doc Scanner",   icon: "file-text",  route: "/document-scanner", iconColor: "#7C3AED", bgColor: "#F3EFFE" },
  { id: "edit-doc",     label: "Edit Doc",      icon: "edit-2",     route: "/edit-document",    iconColor: "#EC4899", bgColor: "#FDF2F8" },
  { id: "qr-generator", label: "QR Generator",  icon: "grid",       route: "/generator",        iconColor: "#10B981", bgColor: "#ECFDF5" },
  { id: "files",        label: "All Files",     icon: "folder",     route: "/(tabs)/files",     iconColor: "#F59E0B", bgColor: "#FFFBEB" },
  { id: "scan-quick",   label: "Quick Scanner",    icon: "zap",        route: "/scanner",          iconColor: "#0099CC", bgColor: "#E0F5FF" },
];

type RecentFile = {
  name: string;
  path: string;
  size: number;
  modTime: number;
  type: "doc" | "qr" | "sig";
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy}  ${hh}:${min}`;
}

function prettyTitle(name: string, type: RecentFile["type"]): string {
  let base = name.replace(/\.(png|jpg|jpeg)$/i, "").replace(/_/g, " ");
  base = base.replace(/\s*\d{10,}\s*$/, "").trim();
  const labelMap = { doc: "Scanned Document", qr: "QR Code", sig: "Signature" } as const;
  const cleaned = base
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return cleaned.length > 0 ? cleaned : labelMap[type];
}

function ToolButton({ tool }: { tool: Tool }) {
  return (
    <TouchableOpacity
      style={styles.toolBtn}
      activeOpacity={0.75}
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(tool.route as any);
      }}
    >
      <View style={[styles.toolCircle, { backgroundColor: tool.bgColor }]}>
        <Feather name={tool.icon as any} size={26} color={tool.iconColor} />
      </View>
      <Text style={styles.toolLabel} numberOfLines={1}>{tool.label}</Text>
    </TouchableOpacity>
  );
}

function FileRow({ file, onPress, onShare }: { file: RecentFile; onPress: () => void; onShare: () => void }) {
  const typeIcon = file.type === "qr" ? "grid" : file.type === "sig" ? "pen-tool" : "file-text";
  const typeColor = file.type === "qr" ? "#7C3AED" : file.type === "sig" ? "#EF4444" : "#0099CC";
  const typeBg = file.type === "qr" ? "#F3EFFE" : file.type === "sig" ? "#FEF0F0" : "#E0F5FF";
  const isImage = /\.(png|jpe?g)$/i.test(file.name);

  return (
    <TouchableOpacity style={styles.fileRow} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.fileThumb, { backgroundColor: typeBg }]}>
        {isImage ? (
          <Image source={{ uri: file.path }} style={styles.fileThumbImage} resizeMode="cover" />
        ) : (
          <Feather name={typeIcon as any} size={20} color={typeColor} />
        )}
      </View>
      <View style={styles.fileMeta}>
        <Text style={styles.fileName} numberOfLines={1}>{prettyTitle(file.name, file.type)}</Text>
        <Text style={styles.fileDate}>{formatDate(file.modTime)}</Text>
      </View>
      <View style={styles.fileActions}>
        <TouchableOpacity style={styles.fileActionBtn} onPress={onShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="share-2" size={16} color={C.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.fileActionBtn} onPress={() => router.push("/files")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="more-vertical" size={16} color={C.text} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

async function loadRecentFiles(): Promise<RecentFile[]> {
  try {
    const files = await listAllFiles();
    const typeMap = { documents: "doc", qrcodes: "qr", signatures: "sig" } as const;
    return files.slice(0, 8).map((f) => ({
      name: f.name,
      path: f.uri,
      size: f.size,
      modTime: f.modifiedAt * 1000,
      type: typeMap[f.type],
    }));
  } catch {
    return [];
  }
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top ;
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadRecentFiles().then(setRecentFiles);
    }, [])
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 16, paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoCircle}>
              <Feather name="aperture" size={22} color="#fff" />
            </View>
            <Text style={styles.appName}>UltraScan</Text>
          </View>
          <TouchableOpacity
            style={styles.searchBtn}
            activeOpacity={0.7}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/files");
            }}
          >
            <Feather name="search" size={22} color={C.text} />
          </TouchableOpacity>
        </View>

        {/* Tools Grid */}
        <View style={styles.toolsGrid}>
          {TOOLS.map((tool) => (
            <ToolButton key={tool.id} tool={tool} />
          ))}
        </View>

        <View style={styles.divider} />

        {/* Recent Files */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Files</Text>
          <TouchableOpacity
            onPress={() => router.push("/files")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="arrow-right" size={20} color={C.primary} />
          </TouchableOpacity>
        </View>

        {recentFiles.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconCircle}>
              <Feather name="folder" size={32} color={C.textTertiary} />
            </View>
            <Text style={styles.emptyText}>No files yet</Text>
            <Text style={styles.emptySubText}>Scan or create something to see it here</Text>
          </View>
        ) : (
          <View style={styles.fileList}>
            {recentFiles.map((file) => (
              <FileRow
                key={file.path}
                file={file}
                onPress={async () => {
                  await Haptics.selectionAsync();
                  if (file.type === "doc") {
                    router.push({ pathname: "/edit-document", params: { uri: file.path } } as any);
                  } else {
                    try { await Sharing.shareAsync(file.path); } catch {}
                  }
                }}
                onShare={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  try { await Sharing.shareAsync(file.path); } catch {}
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const TOOL_COL_WIDTH = "22%";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 22,
    fontFamily: "Livvic_700Bold",
    color: C.text,
    letterSpacing: -0.3,
  },
  searchBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    position: "relative",
    // shadowColor: "#000",
    // shadowOffset: { width: 0, height: 1 },
    // shadowOpacity: 0.06,
    // shadowRadius: 6,
    //elevation: 2,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Tools Grid */
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 20,
    marginBottom: 28,
  },
  toolBtn: {
    width: TOOL_COL_WIDTH,
    alignItems: "center",
    gap: 8,
  },
  toolCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  toolLabel: {
    fontSize: 11,
    fontFamily: "Livvic_500Medium",
    color: C.text,
    textAlign: "center",
  },

  /* Divider */
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 24,
  },

  /* Recent Files */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Livvic_700Bold",
    color: C.text,
  },

  /* Empty state */
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Livvic_600SemiBold",
    color: C.text,
  },
  emptySubText: {
    fontSize: 13,
    fontFamily: "Livvic_400Regular",
    color: C.textSecondary,
    textAlign: "center",
  },

  /* File list */
  fileList: {
    gap: 2,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  fileThumb: {
    width: 52,
    height: 60,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  fileThumbImage: {
    width: "100%",
    height: "100%",
  },
  fileMeta: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontFamily: "Livvic_600SemiBold",
    color: C.text,
    marginBottom: 4,
  },
  fileDate: {
    fontSize: 12,
    fontFamily: "Livvic_400Regular",
    color: C.textSecondary,
  },
  fileActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fileActionBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
