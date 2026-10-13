#!/usr/bin/env python3
"""run_tool.py — adaptador do LADO OpenMontage (AGPLv3).

Corre como processo SEPARADO dentro da árvore do OpenMontage
(~/workspace/open-montagen). Importa as ferramentas AGPL e executa-as,
falando JSON via stdio.

NÃO é importado pelo lado MIT (om_bridge.py / mcp_server.py / MKVideos):
a fronteira de licença é o subprocesso, como o ffmpeg.

Uso:
    python3 run_tool.py <nome_da_ferramenta> '<json_com_inputs>'
    python3 run_tool.py --list
"""

from __future__ import annotations

import dataclasses
import json
import os
import sys

# Garante que os imports 'tools.*' resolvem para a árvore OpenMontage.
OM_ROOT = os.environ.get("OM_ROOT", os.path.expanduser("~/workspace/open-montagen"))
sys.path.insert(0, OM_ROOT)
os.chdir(OM_ROOT)


def _registry():
    from tools.tool_registry import ToolRegistry
    reg = ToolRegistry()
    # Descobre as ferramentas dos pacotes principais.
    for pkg in ("tools.video", "tools.audio", "tools.avatar",
                "tools.subtitle", "tools.analysis", "tools.graphics",
                "tools.enhancement"):
        try:
            reg.discover(pkg)
        except Exception:
            pass
    return reg


def main() -> int:
    if len(sys.argv) >= 2 and sys.argv[1] == "--list":
        reg = _registry()
        try:
            names = sorted(reg.list_all())
        except Exception:
            names = []
        print(json.dumps({"tools": names}))
        return 0
    if len(sys.argv) < 3:
        print(json.dumps({"success": False,
                          "error": "uso: run_tool.py <ferramenta> '<json>'"}))
        return 2
    name = sys.argv[1]
    try:
        inputs = json.loads(sys.argv[2])
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"JSON inválido: {e}"}))
        return 2
    reg = _registry()
    tool = reg.get(name)
    if tool is None:
        print(json.dumps({"success": False,
                          "error": f"ferramenta desconhecida: {name}"}))
        return 3
    try:
        result = tool.execute(inputs)
        print(json.dumps(dataclasses.asdict(result), default=str))
        return 0 if result.success else 4
    except Exception as e:  # noqa: BLE001 — fronteira de processo: serializa o erro
        print(json.dumps({"success": False,
                          "error": f"{type(e).__name__}: {e}"}))
        return 5


if __name__ == "__main__":
    sys.exit(main())
