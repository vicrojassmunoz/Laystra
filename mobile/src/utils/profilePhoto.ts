import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Foto de perfil, solo en el dispositivo.
// Se copia a la carpeta de documentos de la app y en AsyncStorage se guarda SOLO
// el nombre del fichero: iOS puede cambiar la ruta absoluta (el UUID del
// contenedor) entre actualizaciones, así que la ruta se resuelve en cada lectura.
// En web (vista previa) no hay carpeta de documentos: la foto vive en memoria
// mientras dure la pestaña y no se persiste.
const KEY = "profile:photoFile";
const NAME_KEY = "profile:name";

let webPhotoUri: string | null = null;

export async function loadProfileName(): Promise<string> {
  return (await AsyncStorage.getItem(NAME_KEY)) ?? "";
}

export async function saveProfileName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (trimmed) await AsyncStorage.setItem(NAME_KEY, trimmed);
  else await AsyncStorage.removeItem(NAME_KEY);
}

// URI actual de la foto o null (sin foto, o el fichero ya no existe).
export async function loadProfilePhotoUri(): Promise<string | null> {
  if (Platform.OS === "web") return webPhotoUri;
  const name = await AsyncStorage.getItem(KEY);
  if (!name) return null;
  const { File, Paths } = await import("expo-file-system");
  const file = new File(Paths.document, name);
  if (!file.exists) {
    await AsyncStorage.removeItem(KEY);
    return null;
  }
  return file.uri;
}

// Abre la galería, copia la imagen elegida y devuelve su URI (null si cancela).
export async function pickProfilePhoto(): Promise<string | null> {
  const ImagePicker = await import("expo-image-picker");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const picked = result.assets[0].uri;

  if (Platform.OS === "web") {
    webPhotoUri = picked;
    return picked;
  }

  const { File, Paths } = await import("expo-file-system");
  // Nombre nuevo cada vez: así <Image> no sirve la foto anterior desde caché.
  const name = `profile-${Date.now()}.jpg`;
  const target = new File(Paths.document, name);
  new File(picked).copy(target);

  const previous = await AsyncStorage.getItem(KEY);
  await AsyncStorage.setItem(KEY, name);
  if (previous && previous !== name) {
    try {
      const old = new File(Paths.document, previous);
      if (old.exists) old.delete();
    } catch {
      // Borrar la foto anterior es solo limpieza; si falla no importa.
    }
  }
  return target.uri;
}

export async function removeProfilePhoto(): Promise<void> {
  if (Platform.OS === "web") {
    webPhotoUri = null;
    return;
  }
  const name = await AsyncStorage.getItem(KEY);
  await AsyncStorage.removeItem(KEY);
  if (!name) return;
  try {
    const { File, Paths } = await import("expo-file-system");
    const file = new File(Paths.document, name);
    if (file.exists) file.delete();
  } catch {
    // Igual que arriba: limpieza best-effort.
  }
}
