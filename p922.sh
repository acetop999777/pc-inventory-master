docker inspect pc_inv_server | python3 - <<'PY'
import json,sys
o=json.load(sys.stdin)[0]
print("status=", o.get("State",{}).get("Status"),
      "exit=", o.get("State",{}).get("ExitCode"),
      "restarts=", o.get("RestartCount",0),
      "oom=", o.get("State",{}).get("OOMKilled"))
PY
