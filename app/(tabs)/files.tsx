import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Alert,
  Image,
  TextInput,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { router, useFocusEffect } from "expo-router";
import Colors from "@/constants/colors";
import { listAllFiles, deleteFile, type StoredFile, type FileType } from "../../lib/fileStore";

const C = Colors.light;

type SavedFile = StoredFile;

const TYPE_CONFIG: Record<FileType, { icon: string; color: string; bg: string; label: string }> = {
  documents:  { icon: "file-text", color: "#0099CC", bg: "#E0F5FF", label: "Document" },
  qrcodes:    { icon: "grid",      color: "#7C3AED", bg: "#F3EFFE", label: "QR Code" },
  signatures: { icon: "pen-tool",  color: "#EF4444", bg: "#FEF0F0", label: "Signature" },
};

function formatDateTime(ts: number): string {
  const d = new Date(ts * 1000);
  const mm  = String(d.getMonth() + 1).padStart(2, "0");
  const dd  = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh  = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy}  ${hh}:${min}`;
}

function prettyTitle(name: string, type: FileType): string {
  let base = name.replace(/\.(png|jpg|jpeg)$/i, "").replace(/_/g, " ");
  base = base.replace(/\s*\d{10,}\s*$/, "").trim();
  const labelMap: Record<FileType, string> = {
    documents: "Scanned Document",
    qrcodes: "QR Code",
    signatures: "Signature",
  };
  const cleaned = base
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return cleaned.length > 0 ? cleaned : labelMap[type];
}

// ─── Action Sheet ─────────────────────────────────────────────────────────────

type Action = { label: string; icon: string; color?: string; onPress: () => void };

function ActionSheet({
  visible,
  title,
  subtitle,
  actions,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: Action[];
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sheet.overlay}>
        <TouchableOpacity style={sheet.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={sheet.container}>
          <View style={sheet.grabber} />
          {subtitle ? (
            <View style={sheet.header}>
              <Text style={sheet.title} numberOfLines={1}>{title}</Text>
              <Text style={sheet.subtitle}>{subtitle}</Text>
            </View>
          ) : (
            <Text style={[sheet.title, { marginBottom: 16 }]} numberOfLines={1}>{title}</Text>
          )}
          {actions.map((a, i) => (
            <TouchableOpacity
              key={i}
              style={[sheet.row, i < actions.length - 1 && sheet.rowBorder]}
              activeOpacity={0.7}
              onPress={() => { onClose(); setTimeout(a.onPress, 150); }}
            >
              <View style={[sheet.rowIcon, a.color === C.error && sheet.rowIconDanger]}>
                <Feather name={a.icon as any} size={18} color={a.color ?? C.text} />
              </View>
              <Text style={[sheet.rowLabel, a.color ? { color: a.color } : {}]}>{a.label}</Text>
              <Feather name="chevron-right" size={16} color={C.textTertiary} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={sheet.cancelBtn} activeOpacity={0.7} onPress={onClose}>
            <Text style={sheet.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" } as any,
  container: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  grabber: {
    width: 40, height: 5, borderRadius: 3,
    backgroundColor: C.border, alignSelf: "center", marginBottom: 20,
  },
  header: { marginBottom: 20 },
  title: { fontSize: 17, fontFamily: "Livvic_700Bold", color: C.text },
  subtitle: { fontSize: 12, fontFamily: "Livvic_400Regular", color: C.textSecondary, marginTop: 4 },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 15, gap: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  rowIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center",
  },
  rowIconDanger: { backgroundColor: "#FEF0F0" },
  rowLabel: { flex: 1, fontSize: 16, fontFamily: "Livvic_500Medium", color: C.text },
  cancelBtn: {
    marginTop: 14, height: 52, borderRadius: 26,
    backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center",
  },
  cancelText: { fontSize: 16, fontFamily: "Livvic_600SemiBold", color: C.text },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function FilesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [files, setFiles] = useState<SavedFile[]>([]);
  const [query, setQuery] = useState("");
  const [sheetFile, setSheetFile] = useState<SavedFile | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      const all = await listAllFiles();
      setFiles(all);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => { loadFiles(); }, [loadFiles])
  );

  const handleOpen = (file: SavedFile) => {
    Haptics.selectionAsync();
    if (file.type === "documents") {
      router.push({ pathname: "/edit-document", params: { uri: file.uri } } as any);
    } else if (file.type === "signatures") {
      router.push({ pathname: "/sign-document", params: { signatureUri: file.uri } } as any);
    } else {
      handleShare(file);
    }
  };

  const handleShare = async (file: SavedFile) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (Platform.OS === "web") {
        const a = document.createElement("a");
        a.href = file.uri;
        a.download = file.name;
        a.click();
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(file.uri);
    } catch {
      Alert.alert("Error", "Could not share file.");
    }
  };

  const handleCopyUri = (file: SavedFile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "web") {
      navigator.clipboard?.writeText(file.uri).catch(() => {});
    }
    Alert.alert("Copied", "File path copied to clipboard.");
  };

  const handleDelete = (file: SavedFile) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Delete file?",
      `"${prettyTitle(file.name, file.type)}" will be permanently removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteFile(file);
            loadFiles();
          },
        },
      ]
    );
  };

  const openSheet = (file: SavedFile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetFile(file);
  };

  const sheetActions = (file: SavedFile): Action[] => {
    const cfg = TYPE_CONFIG[file.type];
    const actions: Action[] = [];

    // Open / View
    if (file.type === "documents") {
      actions.push({ label: "Open in Editor", icon: "edit-2", onPress: () => handleOpen(file) });
    } else if (file.type === "signatures") {
      actions.push({ label: "Place on Document", icon: "file-plus", onPress: () => handleOpen(file) });
    }

    // Share
    actions.push({ label: "Share", icon: "share-2", onPress: () => handleShare(file) });

    // Copy path (web only)
    if (Platform.OS === "web") {
      actions.push({ label: "Copy Path", icon: "link", onPress: () => handleCopyUri(file) });
    }

    // File info
    actions.push({
      label: `Type: ${cfg.label}`,
      icon: cfg.icon,
      color: cfg.color,
      onPress: () => {},
    });

    // Delete
    actions.push({ label: "Delete", icon: "trash-2", color: C.error, onPress: () => handleDelete(file) });

    return actions;
  };

  const filtered = query.trim()
    ? files.filter((f) =>
        prettyTitle(f.name, f.type).toLowerCase().includes(query.trim().toLowerCase())
      )
    : files;

  const renderItem = ({ item }: { item: SavedFile }) => {
    const cfg = TYPE_CONFIG[item.type];
    const isImage = /\.(png|jpe?g)$/i.test(item.name);

    return (
      <TouchableOpacity
        style={styles.fileRow}
        activeOpacity={0.75}
        onPress={() => handleOpen(item)}
      >
        <View style={[styles.thumb, { backgroundColor: cfg.bg }]}>
          {isImage ? (
            <Image source={{ uri: item.uri }} style={styles.thumbImage} resizeMode="cover" />
          ) : (
            <Feather name={cfg.icon as any} size={24} color={cfg.color} />
          )}
        </View>

        <View style={styles.fileMeta}>
          {/* <View style={[styles.typePill, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.typeLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View> */}
          <Text style={styles.fileTitle} numberOfLines={1}>
            {prettyTitle(item.name, item.type)}
          </Text>
          <Text style={styles.fileDate}>{formatDateTime(item.modifiedAt)}</Text>
        </View>

        <View style={styles.fileActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleShare(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="share-2" size={18} color={C.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => openSheet(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="more-vertical" size={18} color={C.textSecondary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.push("/")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={styles.searchPill}>
          <Feather name="search" size={18} color={C.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search files"
            placeholderTextColor={C.textSecondary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={18} color={C.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.uri}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name={query ? "search" : "folder"} size={36} color={C.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>
              {query ? "No matches" : "No files yet"}
            </Text>
            <Text style={styles.emptyText}>
              {query
                ? `Nothing found for "${query}"`
                : "Saved scans, QR codes, and signatures appear here."}
            </Text>
          </View>
        }
      />

      {/* Action sheet */}
      {sheetFile && (
        <ActionSheet
          visible={!!sheetFile}
          title={prettyTitle(sheetFile.name, sheetFile.type)}
          subtitle={`${TYPE_CONFIG[sheetFile.type].label} · ${formatDateTime(sheetFile.modifiedAt)}`}
          actions={sheetActions(sheetFile)}
          onClose={() => setSheetFile(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40, height: 40,
    alignItems: "center", justifyContent: "center",
  },
  searchPill: {
    flex: 1, flexDirection: "row", alignItems: "center",
    gap: 8, paddingHorizontal: 16, height: 44,
    borderRadius: 22, backgroundColor: "#F3F4F6",
  },
  searchInput: {
    flex: 1, fontSize: 15,
    fontFamily: "Livvic_500Medium",
    color: C.text, paddingVertical: 0,
  },

  listContent: { paddingHorizontal: 16, paddingTop: 4 },

  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F8FA",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  thumb: {
    width: 52,
    height: 68,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: { width: "100%", height: "100%" },

  fileMeta: { flex: 1, gap: 4 },
  typePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 2,
  },
  typeLabel: { fontSize: 11, fontFamily: "Livvic_600SemiBold" },
  fileTitle: {
    fontSize: 15,
    fontFamily: "Livvic_700Bold",
    color: C.text,
  },
  fileDate: {
    fontSize: 12,
    fontFamily: "Livvic_400Regular",
    color: C.textSecondary,
  },

  fileActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  actionBtn: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
    borderRadius: 10,
  },

  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center", marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 20, fontFamily: "Livvic_700Bold",
    color: C.text, marginBottom: 8,
  },
  emptyText: {
    fontSize: 14, fontFamily: "Livvic_400Regular",
    color: C.textSecondary, textAlign: "center", lineHeight: 22,
  },
});
