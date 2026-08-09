import json
import os
import sys
import tempfile

payload = json.load(sys.stdin)
agent_id = payload.get("agent_id", "unknown")
marker = os.path.join(tempfile.gettempdir(), f"claude-backend-docs-notified-{agent_id}")

# SubagentStop fires again after backend-coder's follow-up turn (the one where
# it acts on this reminder) ends too. Without this marker the reminder would
# re-fire on that follow-up stop as well, forcing another turn, forever.
if os.path.exists(marker):
    sys.exit(0)

open(marker, "w").close()

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SubagentStop",
        "additionalContext": (
            "El subagente backend-coder acaba de terminar. Invoca el subagente "
            "backend-docs (Agent tool, subagent_type: backend-docs) para regenerar "
            "backend/docs/ARCHITECTURE.md y que refleje el estado actual del codigo. "
            "Este es el unico recordatorio para esta ejecucion - no hace falta "
            "ninguna accion mas sobre esto despues de invocarlo."
        ),
    }
}))
