"""Cursor hook: remind parent agent to run frontend-docs after frontend-coder finishes."""
import json
import os
import sys
import tempfile

payload = json.load(sys.stdin)
agent_id = payload.get("agent_id", "unknown")
marker = os.path.join(tempfile.gettempdir(), f"cursor-frontend-docs-notified-{agent_id}")

if os.path.exists(marker):
    sys.exit(0)

open(marker, "w", encoding="utf-8").close()

print(json.dumps({
    "followup_message": (
        "El subagente frontend-coder acaba de terminar. Invoca el subagente "
        "frontend-docs (Task tool, subagent_type: frontend-docs) para regenerar "
        "mobile/docs/ARCHITECTURE.md y que refleje el estado actual del código. "
        "Este es el único recordatorio para esta ejecución."
    )
}))
