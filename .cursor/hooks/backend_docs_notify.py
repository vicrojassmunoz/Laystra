"""Cursor hook: remind parent agent to run backend-docs after backend-coder finishes."""
import json
import os
import sys
import tempfile

payload = json.load(sys.stdin)
agent_id = payload.get("agent_id", "unknown")
marker = os.path.join(tempfile.gettempdir(), f"cursor-backend-docs-notified-{agent_id}")

# subagentStop fires again after the follow-up turn that acts on this reminder.
# Without the marker, the reminder would re-fire and loop forever.
if os.path.exists(marker):
    sys.exit(0)

open(marker, "w", encoding="utf-8").close()

print(json.dumps({
    "followup_message": (
        "El subagente backend-coder acaba de terminar. Invoca el subagente "
        "backend-docs (Task tool, subagent_type: backend-docs) para regenerar "
        "backend/docs/ARCHITECTURE.md y que refleje el estado actual del código. "
        "Este es el único recordatorio para esta ejecución — no hace falta "
        "ninguna acción más sobre esto después de invocarlo."
    )
}))
