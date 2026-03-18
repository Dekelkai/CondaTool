import sys
import os
import re
import threading
import subprocess
from .utils import log, emit_result, get_conda_path, run_conda_command_for_json, stream_conda_command

def cmd_probe(args):
    success, data = run_conda_command_for_json(["info", "--json"], "probe")
    if success: emit_result("probe", {"ok": True, "data": data})

def cmd_env_list(args):
    success, data = run_conda_command_for_json(["env", "list", "--json"], "env-list")
    if not success: return
    env_paths = data.get("envs", [])
    enriched_envs = [None] * len(env_paths)
    threads = []
    
    def _probe_python_version(env_path, index):
        python_version = "N/A"
        try:
            python_exe = os.path.join(env_path, "python.exe") if sys.platform == "win32" else os.path.join(env_path, "bin", "python")
            if not os.path.exists(python_exe): raise FileNotFoundError("python executable not found")
            py_version_proc = subprocess.run([python_exe, "--version"], capture_output=True, text=True, timeout=5, encoding='utf-8', check=True)
            output = py_version_proc.stdout.strip() or py_version_proc.stderr.strip()
            if "Python" in output: python_version = output.split()[-1]
        except Exception as e:
            log(f"Could not get Python version for '{os.path.basename(env_path)}': {e}", stream="stderr")
        enriched_envs[index] = {"path": env_path, "python_version": python_version}
        
    for i, env_path in enumerate(env_paths):
        thread = threading.Thread(target=_probe_python_version, args=(env_path, i))
        threads.append(thread)
        thread.start()
    for thread in threads: thread.join()
    
    log("'env-list' (with Python versions) successful.")
    emit_result("env-list", {"ok": True, "data": enriched_envs})

def cmd_pkg_list(args):
    success, data = run_conda_command_for_json(["list", "--prefix", args.prefix, "--json"], "pkg-list")
    if success: emit_result("pkg-list", {"ok": True, "data": data})

def cmd_env_create(args):
    stream_conda_command(["create", "--name", args.name, f"python={args.python}", "--yes"], "env-create")

def cmd_env_remove(args):
    stream_conda_command(["env", "remove", "--prefix", args.prefix, "--yes"], "env-remove")

def cmd_env_rename(args):
    clone_success = stream_conda_command(["create", "--name", args.new_name, "--clone", args.old_prefix, "--yes"], "env-rename", emit_final_result=False)
    if not clone_success:
        emit_result("env-rename", {"ok": False, "error": "Cloning step failed."}); return
    remove_success = stream_conda_command(["env", "remove", "--prefix", args.old_prefix, "--yes"], "env-rename", emit_final_result=False)
    if not remove_success:
        emit_result("env-rename", {"ok": False, "error": "Clone succeeded, but remove step failed."}); return
    emit_result("env-rename", {"ok": True})

def cmd_env_export(args):
    try:
        conda_path = get_conda_path()
        if not conda_path: raise Exception("Conda not found in PATH")
        cmd = [conda_path]
        output = ""
        
        if args.format == "yml":
            export_cmd = ["env", "export", "--name", args.name]
            if args.no_builds: export_cmd.append("--no-builds")
            cmd.extend(export_cmd)
            proc = subprocess.run(cmd, capture_output=True, text=True, check=True, encoding='utf-8')
            lines = proc.stdout.splitlines()
            cleaned_lines = [line for line in lines if not line.startswith('prefix:')]
            output = "\n".join(cleaned_lines)
            
        elif args.format == "txt":
            export_cmd = ["list", "--export", "--name", args.name]
            cmd.extend(export_cmd)
            proc = subprocess.run(cmd, capture_output=True, text=True, check=True, encoding='utf-8')
            output = proc.stdout
            if args.no_builds:
                lines = output.splitlines()
                processed_lines = [re.sub(r'=[^=]*$', '', line) for line in lines if not line.startswith('#')]
                output = "\n".join(processed_lines)
                
        with open(args.file, 'w', encoding='utf-8') as f: f.write(output)
        emit_result("env-export", {"ok": True})
    except Exception as e:
        error_message = str(e)
        if isinstance(e, subprocess.CalledProcessError): error_message = e.stderr.strip() or e.stdout.strip()
        emit_result("env-export", {"ok": False, "error": error_message})

def cmd_env_import(args):
    stream_conda_command(["env", "create", "--file", args.file, "--name", args.name, "--yes"], "env-import")

def cmd_env_clone(args):
    stream_conda_command(["create", "--name", args.dest_name, "--clone", args.source_prefix, "--yes"], "env-clone")
