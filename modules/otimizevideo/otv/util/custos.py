import json, time
from pathlib import Path

def registrar(dir, fase, dados):
    p = Path(dir) / "custos.json"
    # [MKVIDEOS PATCH] I/O de JSON sempre em UTF-8, independente do locale do SO.
    atual = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    atual[fase] = {**dados, "quando": time.strftime("%Y-%m-%dT%H:%M:%S")}
    p.write_text(json.dumps(atual, ensure_ascii=False, indent=1), encoding="utf-8")
