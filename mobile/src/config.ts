const RAW_API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!RAW_API_BASE_URL) {
  throw new Error(
    "EXPO_PUBLIC_API_URL no está definida. Copia .env.example a .env y pon la IP LAN de tu backend."
  );
}

// Quita la barra final si el usuario la puso en .env (p.ej. "http://192.168.1.100:8000/"),
// para que las llamadas no queden como "//routines".
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, "");

export { API_BASE_URL };
