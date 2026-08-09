const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error(
    "EXPO_PUBLIC_API_URL no está definida. Copia .env.example a .env y pon la IP LAN de tu backend."
  );
}

export { API_BASE_URL };
