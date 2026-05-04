import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

export type FileType = "documents" | "qrcodes" | "signatures";

export type StoredFile = {
  name: string;
  uri: string;
  type: FileType;
  modifiedAt: number;
  size: number;
};

const WEB_KEY = "ultrascan_files_v1";

type WebRecord = {
  name: string;
  type: FileType;
  dataUri: string;
  modifiedAt: number;
  size: number;
};

function readWebStore(): WebRecord[] {
  try {
    const raw = (globalThis as any).localStorage?.getItem(WEB_KEY);
    return raw ? (JSON.parse(raw) as WebRecord[]) : [];
  } catch {
    return [];
  }
}

function writeWebStore(records: WebRecord[]) {
  try {
    (globalThis as any).localStorage?.setItem(WEB_KEY, JSON.stringify(records));
  } catch {}
}

async function uriToDataUri(uri: string): Promise<string> {
  if (uri.startsWith("data:")) return uri;
  const res = await fetch(uri);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function saveFile(
  type: FileType,
  sourceUri: string,
  namePrefix = "file",
  ext: "png" | "jpg" = "png"
): Promise<string> {
  const stamp = Date.now();
  const fileName = `${namePrefix}_${stamp}.${ext}`;

  if (Platform.OS === "web") {
    const dataUri = await uriToDataUri(sourceUri);
    const records = readWebStore();
    records.push({
      name: fileName,
      type,
      dataUri,
      modifiedAt: stamp,
      size: dataUri.length,
    });
    writeWebStore(records);
    return dataUri;
  }

  const dir = FileSystem.documentDirectory + type + "/";
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = dir + fileName;

  if (sourceUri.startsWith("http://") || sourceUri.startsWith("https://")) {
    await FileSystem.downloadAsync(sourceUri, dest);
  } else {
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
  }
  return dest;
}

export async function listAllFiles(): Promise<StoredFile[]> {
  if (Platform.OS === "web") {
    const records = readWebStore();
    return records
      .map((r) => ({
        name: r.name,
        uri: r.dataUri,
        type: r.type,
        modifiedAt: Math.floor(r.modifiedAt / 1000),
        size: r.size,
      }))
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  const types: FileType[] = ["documents", "qrcodes", "signatures"];
  const out: StoredFile[] = [];
  for (const t of types) {
    const dir = FileSystem.documentDirectory + t + "/";
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) continue;
    const names = await FileSystem.readDirectoryAsync(dir);
    for (const name of names) {
      const uri = dir + name;
      const info = await FileSystem.getInfoAsync(uri, { size: true });
      if (info.exists) {
        out.push({
          name,
          uri,
          type: t,
          modifiedAt: (info as any).modificationTime ?? Date.now() / 1000,
          size: (info as any).size ?? 0,
        });
      }
    }
  }
  out.sort((a, b) => b.modifiedAt - a.modifiedAt);
  return out;
}

export async function deleteFile(file: StoredFile): Promise<void> {
  if (Platform.OS === "web") {
    const records = readWebStore().filter((r) => r.name !== file.name);
    writeWebStore(records);
    return;
  }
  await FileSystem.deleteAsync(file.uri, { idempotent: true });
}

export function isWeb(): boolean {
  return Platform.OS === "web";
}
