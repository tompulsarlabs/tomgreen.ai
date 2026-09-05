"""Run a pipeline script through the Blender executable's bundled Python.

blender -b --python run_script.py -- path/to/script.py [script arguments]
GP_PYTHONPATH may point to a separate numpy/scipy/Pillow installation.
"""
import os
import runpy
import sys

for path in reversed(os.environ.get("GP_PYTHONPATH", "").split(os.pathsep)):
    if path:
        sys.path.insert(0, path)
sys.argv = sys.argv[sys.argv.index("--") + 1:]
if not sys.argv:
    raise SystemExit("Pass a Python script after --")
runpy.run_path(sys.argv[0], run_name="__main__")
