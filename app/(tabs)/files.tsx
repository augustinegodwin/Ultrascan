import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { router } from "expo-router";
import Colors from "@/constants/colors";

const C = Colors.light;

type SavedFile = {
  name: string;
  uri: string;
  type: "document" | "qrcode" | "signature";
  modifiedAt: number;
  size: number;
};

const FOLDERS: Record<string, "document" | "qrcode" | "signature"> = {
  documents: "document",
  qrcodes: "qrcode",
  signatures: "signature",
};

const TYPE_CONFIG = {
  document: { icon: "file-text", color: "#10B981", label: "Document" },
  qrcode: { icon: "grid", color: "#0099CC", label: "QR Code" },
  signature: { icon: "pen-tool", color: "#EF4444", label: "Signature" },
};

export default function FilesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [files, setFiles] = useState<SavedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "document" | "qrcode" | "signature"
  >("all");

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const allFiles: SavedFile[] = [];
      for (const [folder, type] of Object.entries(FOLDERS)) {
        const dir = FileSystem.documentDirectory + folder + "/";
        const dirInfo = await FileSystem.getInfoAsync(dir);
        if (dirInfo.exists) {
          const names = await FileSystem.readDirectoryAsync(dir);
          for (const name of names) {
            const uri = dir + name;
            const info = await FileSystem.getInfoAsync(uri, { size: true });
            if (info.exists) {
              allFiles.push({
                name,
                uri,
                type,
                modifiedAt: info.modificationTime ?? Date.now() / 1000,
                size: info.size ?? 0,
              });
            }
          }
        }
      }
      allFiles.sort((a, b) => b.modifiedAt - a.modifiedAt);
      setFiles(allFiles);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleShare = async (file: SavedFile) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri);
      }
    } catch (e) {
      Alert.alert("Error", "Could not share file.");
    }
  };

  const handleDelete = (file: SavedFile) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Delete File", `Delete "${file.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await FileSystem.deleteAsync(file.uri, { idempotent: true });
          loadFiles();
        },
      },
    ]);
  };

  const filtered =
    filter === "all" ? files : files.filter((f) => f.type === filter);

  const renderItem = ({ item }: { item: SavedFile }) => {
    const cfg = TYPE_CONFIG[item.type];
    const isImage = item.name.endsWith(".png") || item.name.endsWith(".jpg");

    return (
      <TouchableOpacity
        style={styles.fileItem}
        activeOpacity={0.75}
        onPress={() => {
          if (item.type === "document") {
            router.push({
              pathname: "/edit-document",
              params: { uri: item.uri },
            } as any);
          }
        }}
      >
        <View style={[styles.fileThumb, { backgroundColor: `${cfg.color}15` }]}>
          {isImage ? (
            <Image
              source={{ uri: item.uri }}
              style={styles.thumbImage}
              resizeMode="cover"
            />
          ) : (
            <Feather name={cfg.icon as any} size={22} color={cfg.color} />
          )}
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.fileMeta}>
            {cfg.label} · {Math.round(item.size / 1024)} KB
          </Text>
        </View>
        <View style={styles.fileActions}>
          <TouchableOpacity
            onPress={() => handleShare(item)}
            style={styles.actionBtn}
          >
            <Feather name="share" size={17} color={C.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            style={styles.actionBtn}
          >
            <Feather name="trash-2" size={17} color={C.error} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const filterOptions: Array<{ key: typeof filter; label: string }> = [
    { key: "all", label: "All" },
    { key: "document", label: "Docs" },
    { key: "qrcode", label: "QR" },
    { key: "signature", label: "Sigs" },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={styles.headerTitle}>Files</Text>
        <TouchableOpacity onPress={loadFiles} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={17} color={C.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        {filterOptions.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.filterChip,
              filter === opt.key && styles.filterChipActive,
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setFilter(opt.key);
            }}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === opt.key && styles.filterChipTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.uri}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="folder" size={36} color={C.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No files yet</Text>
            <Text style={styles.emptyText}>
              Saved QR codes, documents, and signatures will appear here.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: C.text,
    letterSpacing: -0.5,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterChipActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
  },
  filterChipTextActive: {
    color: "#fff",
  },
  listContent: {
    paddingHorizontal: 20,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  fileThumb: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: { width: "100%", height: "100%" },
  fileInfo: { flex: 1, marginLeft: 12 },
  fileName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
    marginBottom: 3,
  },
  fileMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  fileActions: { flexDirection: "row", gap: 4 },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.background,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
