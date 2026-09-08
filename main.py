from pathlib import Path
import runpy


serverPath = Path(__file__).resolve().parent / "masterServer" / "masterServer.py"
runpy.run_path(str(serverPath), run_name="__main__")
