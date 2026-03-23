import sys
import json
import shutil
import subprocess

def log(line: str, stream="stdout"):
    """
    Log output function to stdout or stderr.
    :param line: Log content
    :param stream: Output stream, "stdout" or "stderr"
    """
    print(line, flush=True, file=sys.stdout if stream == "stdout" else sys.stderr)

def emit_result(command: str, data: dict):
    """
    Emit command execution result in JSON format.
    :param command: Command name
    :param data: Data dictionary
    """
    result = {"command": command, **data}
    print(json.dumps(result), flush=True)

def get_conda_path():
    """
    Get the path to the conda executable.
    :return: Conda executable path or None
    """
    return shutil.which("conda")

def run_conda_command_for_json(args: list, command_name: str):
    """
    Execute conda command and parse JSON output.
    :param args: Conda command argument list
    :param command_name: Command name for emit_result
    :return: (success, data) boolean success status, and parsed JSON data
    """
    conda_path = get_conda_path()
    if not conda_path:
        emit_result(command_name, {"ok": False, "error": "Conda not found in PATH"})
        return False, None
    full_command = [conda_path] + args
    try:
        proc = subprocess.run(full_command, capture_output=True, text=True, check=True, encoding='utf-8', timeout=30)
        return True, json.loads(proc.stdout)
    except Exception as e:
        error_message = str(e)
        if isinstance(e, subprocess.CalledProcessError):
            error_message = e.stderr.strip() or e.stdout.strip()
        log(f"Error during '{command_name}': {error_message}", stream="stderr")
        emit_result(command_name, {"ok": False, "error": error_message})
        return False, None

def stream_conda_command(args: list, command_name: str, emit_final_result=True) -> bool:
    """
    Execute conda command and stream output in real-time.
    :param args: Conda command argument list
    :param command_name: Command name
    :param emit_final_result: Whether to emit final JSON result
    :return: True if command is successful, otherwise False
    """
    conda_path = get_conda_path()
    if not conda_path:
        if emit_final_result: emit_result(command_name, {"ok": False, "error": "Conda not found in PATH"})
        return False
    full_command = [conda_path] + args
    log(f"Executing: {' '.join(full_command)}")
    try:
        process = subprocess.Popen(full_command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', bufsize=1)
        for line in iter(process.stdout.readline, ''):
            log(line.strip())
        process.wait()
        if process.returncode == 0:
            log(f"Sub-command '{' '.join(args)}' successful.")
            if emit_final_result: emit_result(command_name, {"ok": True})
            return True
        else:
            log(f"Sub-command '{' '.join(args)}' failed with exit code {process.returncode}.", stream="stderr")
            if emit_final_result: emit_result(command_name, {"ok": False, "error": f"Process failed with exit code {process.returncode}."})
            return False
    except Exception as e:
        log(f"An unexpected error occurred: {e}", stream="stderr")
        if emit_final_result: emit_result(command_name, {"ok": False, "error": str(e)})
        return False
