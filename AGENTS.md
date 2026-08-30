# Laystra — guía para agentes (Cursor)

Este repo usa **Cursor** con subagentes, reglas y hooks en `.cursor/`.

## Flujo de trabajo

```
explorer → implementación → verifier → reviewer
                ↓
         backend-docs / frontend-docs (auto vía hooks)
```

Ver `.cursor/rules/workflow.mdc` para el detalle.

## Subagentes (`.cursor/agents/`)

| Agente | Cuándo usarlo |
|---|---|
| `explorer` | Antes de tocar código — mapea ficheros, contrato API, dependencias |
| `backend-coder` | Endpoints, modelos, DB, tests de backend |
| `frontend-coder` | Pantallas, navegación, consumo de API |
| `eas-agent` | `eas.json`, builds EAS, variables de entorno |
| `verifier` | Tras implementar — ejecuta `pytest` y/o `npm run typecheck` |
| `reviewer` | Antes de cerrar — informe `[bloqueante]`/`[sugerencia]` |
| `backend-docs` | Actualizar `backend/docs/ARCHITECTURE.md` (auto tras `backend-coder`) |
| `frontend-docs` | Actualizar `mobile/docs/ARCHITECTURE.md` (auto tras `frontend-coder`) |

Invocar con el **Task tool**: `subagent_type: "nombre-del-agente"`.

## Reglas (`.cursor/rules/`)

| Regla | Propósito |
|---|---|
| `workflow` | Flujo estándar para features |
| `api-contract` | Mapa backend schema ↔ mobile types/api ↔ pantallas |
| `project-context` | Alcance, arquitectura, contexto del desarrollador |
| `project-status` | Estado MVP + v1; qué es ROADMAP vs entregado |
| `commands` | Comandos backend/mobile/Docker |
| `git-and-branches` | Commits, estrategia `dev`/`main` |
| `mobile-expo` | SDK 54 + patrones de pantalla |

## Hooks (`.cursor/hooks.json`)

| Evento | Acción |
|---|---|
| `subagentStop` + `backend-coder` | Recordatorio → `backend-docs` |
| `subagentStop` + `frontend-coder` | Recordatorio → `frontend-docs` |

## Documentación humana

| Fichero | Contenido |
|---|---|
| `docs/MVP.md` | Spec MVP |
| `docs/V1.md` | Spec v1 (entregado) |
| `docs/ROADMAP.md` | Ideas futuras — no implementar salvo petición |
| `docs/CHANGELOG.md` | Entregado |
| `backend/docs/ARCHITECTURE.md` | API y modelo backend |
| `mobile/docs/ARCHITECTURE.md` | Navegación y convenciones mobile |

## Ramas

Solo `dev` lleva tooling de IA (`.cursor/`, `.claude/`). `main` recibe solo `backend`, `mobile` y `.gitignore` vía checkout selectivo.

## Compatibilidad Claude Code

`.claude/agents/` y `CLAUDE.md` siguen en `dev`. Cursor prioriza `.cursor/agents/` si hay conflicto de nombres.
