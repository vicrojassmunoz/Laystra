# tools/visual — ver la UI sin Mac

No hay Simulator de iOS, así que la UI se revisa en la **vista web de Expo** con un navegador Chromium en modo headless. Esto sirve para layout, color, tipografía y modo claro/oscuro. **No es la verdad del iPhone** (fuentes, cabecera nativa, safe areas, hápticos y animaciones del sistema difieren) y **no detecta errores solo nativos**.

## Preparación

```
cd tools/visual && npm install            # solo playwright-core, sin descargar navegador
# En otra terminal:
cd backend && uv run uvicorn app.main:app --host 0.0.0.0        # backend en :8000
cd mobile && npx expo start --web                                # web en :8081
```

El navegador se lanza con el ejecutable de **Helium** (`C:\Users\victo\AppData\Local\imput\Helium\Application\chrome.exe`, ruta fija en `HELIUM` dentro de cada script — cámbiala si usas otro Chromium) con un perfil temporal, sin tocar tu ventana ni tus sesiones.

## Scripts

| Script | Uso |
|---|---|
| `shoot-all.mjs` | `node shoot-all.mjs <carpeta> <light\|dark>` — recorre Home, Hoy, Sesión, Agua, Historial, Rutinas, Progreso, Perfil, Objetivos, Análisis y Semana y guarda PNG (390×844 @2x) |
| `shoot-screen.mjs` | `node shoot-screen.mjs <carpeta> <light\|dark> <historial\|rutinas\|progreso\|analisis\|semana\|objetivos\|picker>` — flujos concretos (tarjeta abierta, edición, hoja…) |
| `check-motion.mjs` | Comprueba en el DOM la escala al pulsar (0.97), la transición de las barras y que no haya errores de consola |

## Cuidado

- Los scripts hacen clic en la app real: **no pulsan Guardar/Borrar**, pero revisa antes de añadir flujos que escriban. Para probar escrituras sin tocar la base de datos, intercepta las peticiones con `page.route(...)` (responder `/today` y los `POST` en el navegador).
- Las comprobaciones de "tacto" (hápticos, fluidez) hay que hacerlas en el iPhone con un build de release.
