import os
import sys
import json
import shutil
import subprocess


PACKAGE_MANAGER_PATH = None


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


def set_package_manager_path(path: str | None):
    global PACKAGE_MANAGER_PATH
    PACKAGE_MANAGER_PATH = path.strip() if path else None


def get_package_manager_path():
    """
    Resolve the package manager executable path with precedence:
    1) CLI argument from Rust launcher
    2) Environment variables
    3) PATH lookup
    """
    if PACKAGE_MANAGER_PATH and os.path.exists(PACKAGE_MANAGER_PATH):
        return PACKAGE_MANAGER_PATH

    env_candidates = [
        os.environ.get("CONDATOOL_PACKAGE_MANAGER"),
        os.environ.get("MAMBA_EXE"),
        os.environ.get("CONDA_EXE"),
    ]
    for candidate in env_candidates:
        if candidate and os.path.exists(candidate):
            return candidate

    which_candidates = [
        shutil.which("micromamba"),
        shutil.which("mamba"),
        shutil.which("conda"),
    ]
    for candidate in which_candidates:
        if candidate:
            return candidate

    return None


def get_package_manager_kind():
    package_manager_path = get_package_manager_path()
    if not package_manager_path:
        return "unknown"

    executable_name = os.path.basename(package_manager_path).lower()
    if "micromamba" in executable_name:
        return "micromamba"
    if executable_name == "mamba.exe" or executable_name == "mamba":
        return "mamba"
    if "conda" in executable_name:
        return "conda"

    return executable_name or "unknown"


def run_package_manager_command_for_json(args: list, command_name: str):
    """
    Execute package manager command and parse JSON output.
    :param args: command argument list
    :param command_name: command name for emit_result
    :return: (success, data)
    """
    package_manager_path = get_package_manager_path()
    if not package_manager_path:
        emit_result(command_name, {"ok": False, "error": "package manager init failed: executable not found"})
        return False, None

    full_command = [package_manager_path] + args
    try:
        proc = subprocess.run(full_command, capture_output=True, text=True, check=True, encoding="utf-8", timeout=60)
        return True, json.loads(proc.stdout)
    except Exception as e:
        error_message = str(e)
        if isinstance(e, subprocess.CalledProcessError):
            error_message = e.stderr.strip() or e.stdout.strip()
        log(f"Error during '{command_name}': {error_message}", stream="stderr")
        emit_result(command_name, {"ok": False, "error": error_message})
        return False, None


def stream_package_manager_command(args: list, command_name: str, emit_final_result=True) -> bool:
    """
    Execute package manager command and stream output in real-time.
    :param args: command argument list
    :param command_name: command name
    :param emit_final_result: whether to emit final JSON result
    :return: True if command successful, else False
    """
    package_manager_path = get_package_manager_path()
    if not package_manager_path:
        if emit_final_result:
            emit_result(command_name, {"ok": False, "error": "package manager init failed: executable not found"})
        return False

    full_command = [package_manager_path] + args
    log(f"Executing: {' '.join(full_command)}")
    try:
        process = subprocess.Popen(
            full_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            bufsize=1,
        )
        for line in iter(process.stdout.readline, ""):
            log(line.strip())
        process.wait()
        if process.returncode == 0:
            log(f"Sub-command '{' '.join(args)}' successful.")
            if emit_final_result:
                emit_result(command_name, {"ok": True})
            return True

        log(f"Sub-command '{' '.join(args)}' failed with exit code {process.returncode}.", stream="stderr")
        if emit_final_result:
            emit_result(command_name, {"ok": False, "error": f"Process failed with exit code {process.returncode}."})
        return False
    except Exception as e:
        log(f"An unexpected error occurred: {e}", stream="stderr")
        if emit_final_result:
            emit_result(command_name, {"ok": False, "error": str(e)})
        return False
