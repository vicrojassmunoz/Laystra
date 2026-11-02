import { View } from "react-native";

import { makeStyles, radius, space, useTheme } from "../theme/theme";
import { PrFlags } from "../utils/pr";
import Icon from "./ui/Icon";
import Txt from "./ui/Txt";

const useStyles = makeStyles(({ colors }) => ({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.xs,
    paddingVertical: 3,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.goldSoft,
  },
}));

// Insignia de PR para una serie: récord de peso (trofeo) y/o de volumen
// peso×reps (rayo) -- pueden darse las dos a la vez (ver prFlags/computePrFlags).
// Se pinta en dos sitios -- ejercicios sueltos (SesionScreen) y dentro de un
// bloque de super-serie (SupersetBlock, compartido también con HistorialScreen,
// que no pasa prBySetId y por tanto nunca la pinta).
export default function PrBadge({ flags }: { flags: PrFlags }) {
  const styles = useStyles();
  const { colors } = useTheme();

  if (!flags.weight && !flags.volume) {
    return null;
  }

  const label =
    flags.weight && flags.volume ? "PR peso y volumen" : flags.weight ? "PR de peso" : "PR de volumen";

  return (
    <View style={styles.badge} accessibilityLabel={label}>
      {flags.weight ? <Icon name="trophy" size={13} color={colors.gold} /> : null}
      {flags.volume ? <Icon name="volume" size={13} color={colors.gold} /> : null}
      <Txt variant="caption" weight="700" tone="gold">
        {label}
      </Txt>
    </View>
  );
}
