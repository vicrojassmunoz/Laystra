# Laystra — guía para agentes (Cursor)

Este repo usa **Cursor** con subagentes y reglas de proyecto. El setup equivalente a Claude Code vive en `.cursor/`.

## Subagentes (`.cursor/agents/`)

| Agente | Cuándo usarlo |
|---|---|
| `explorer` | Antes de tocar código en una feature nueva — mapea ficheros y dependencias backend↔frontend |
| `backend-coder` | Endpoints, modelos, DB, tests de backend |
| `frontend-coder` | Pantallas, navegación, consumo de API |
| `eas-agent` | `eas.json`, builds EAS, variables de entorno |
| `reviewer` | Tras cambios significativos — solo lectura, informe `[bloqueante]`/`[sugerencia]` |
| `backend-docs` | Actualizar `backend/docs/ARCHITECTURE.md` (auto tras `backend-coder`) |

Invocar con el **Task tool**: `subagent_type: "nombre-del-agente"`.

Flujo típico: `explorer` → implementación (`backend-coder` / `frontend-coder` / `eas-agent`) → `reviewer`.

## Reglas (`.cursor/rules/`)

Contexto persistente: git/ramas, comandos, alcance del producto, estado por fases, restricciones Expo en `mobile/`.

## Hooks (`.cursor/hooks.json`)

Al terminar `backend-coder`, un hook dispara un recordatorio para invocar `backend-docs` (una sola vez por ejecución).

## Compatibilidad Claude Code

`.claude/agents/` y `CLAUDE.md` siguen en `dev` por si usas Claude Code en paralelo. Cursor prioriza `.cursor/agents/` si hay conflicto de nombres.

## Ramas

Solo `dev` lleva tooling de IA (`.cursor/`, `.claude/`). `main` recibe solo `backend`, `mobile` y `.gitignore` vía checkout selectivo — ver `.cursor/rules/git-and-branches.mdc`.

## Documentación humana

- MVP: `docs/MVP.md`
- Roadmap: `docs/ROADMAP.md`
- Changelog: `docs/CHANGELOG.md`
- Arquitectura backend: `backend/docs/ARCHITECTURE.md`
