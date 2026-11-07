import { useState } from "react";
import { Image, View } from "react-native";

import { makeStyles, useTheme } from "../../theme/theme";
import Icon from "../ui/Icon";
import Txt from "../ui/Txt";

const useStyles = makeStyles(({ colors }) => ({
  circle: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.tintSoft,
    overflow: "hidden",
  },
}));

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + second).toUpperCase();
}

// Foto de perfil redonda. Sin foto (o si la imagen falla al cargar) cae a las
// iniciales del nombre y, sin nombre, a un icono de persona.
export default function Avatar({
  uri,
  name,
  size = 88,
}: {
  uri: string | null;
  name: string;
  size?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = uri !== null && uri !== failedUri;
  const initials = initialsOf(name);

  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityLabel={showImage ? "Foto de perfil" : "Sin foto de perfil"}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          onError={() => setFailedUri(uri)}
        />
      ) : initials ? (
        <Txt variant="title1" style={{ color: colors.tint }}>
          {initials}
        </Txt>
      ) : (
        <Icon name="profile" size={size * 0.5} color={colors.tint} />
      )}
    </View>
  );
}
