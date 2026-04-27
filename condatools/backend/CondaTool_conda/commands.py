import sys
import os
import re
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from .utils import (
    log,
    emit_result,
    get_package_manager_path,
    get_package_manager_kind,
    run_package_manager_command_for_json,
    stream_package_manager_command,
)


SOURCE_PRESETS = {
    "defaults": {
        "channels": ["defaults"],
        "channel_priority": "flexible",
        "default_channels": [
            "https://repo.anaconda.com/pkgs/main",
            "https://repo.anaconda.com/pkgs/r",
            "https://repo.anaconda.com/pkgs/msys2",
        ],
        "custom_channels": {
            "conda-forge": "https://conda.anaconda.org",
            "msys2": "https://conda.anaconda.org",
            "bioconda": "https://conda.anaconda.org",
            "menpo": "https://conda.anaconda.org",
            "pytorch": "https://conda.anaconda.org",
            "simpleitk": "https://conda.anaconda.org",
        },
    },
    "tuna": {
        "channels": ["defaults"],
        "channel_priority": "flexible",
        "default_channels": [
            "https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main",
            "https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/r",
            "https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/msys2",
        ],
        "custom_channels": {
            "conda-forge": "https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud",
            "msys2": "https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud",
            "bioconda": "https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud",
            "menpo": "https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud",
            "pytorch": "https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud",
            "simpleitk": "https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud",
        },
    },
}

MANAGED_SOURCE_KEYS = {"channel_priority", "channels", "default_channels", "custom_channels"}


def _get_user_condarc_path():
    return os.path.join(os.path.expanduser("~"), ".condarc")


def _get_conda_cli_path():
    env_candidate = os.environ.get("CONDA_EXE")
    if env_candidate and os.path.exists(env_candidate):
        return env_candidate

    return "conda"


def _run_json_command(full_command):
    try:
        proc = subprocess.run(full_command, capture_output=True, text=True, check=True, encoding="utf-8", timeout=60)
        return True, json.loads(proc.stdout)
    except Exception:
        return False, None


def _normalize_channel_value(channel_item):
    if isinstance(channel_item, str):
        return channel_item

    if isinstance(channel_item, dict):
        location = channel_item.get("location")
        name = channel_item.get("name")
        scheme = channel_item.get("scheme", "https")
        if location and name:
            return f"{scheme}://{location}/{name}"

    return None


def _normalize_custom_channels(raw_custom_channels):
    if not isinstance(raw_custom_channels, dict):
        return {}

    normalized_custom_channels = {}
    for key, value in raw_custom_channels.items():
        normalized_key = str(key)
        if normalized_key.startswith("anaconda/pkgs/"):
            continue
        normalized_value = _normalize_channel_value(value)
        if normalized_value is None and value:
            normalized_value = str(value)
        if normalized_value:
            normalized_custom_channels[normalized_key] = normalized_value

    return normalized_custom_channels


def _normalize_channel_priority(raw_value):
    normalized_value = str(raw_value).strip().lower()
    if normalized_value in {"strict", "flexible", "disabled"}:
        return normalized_value
    if normalized_value == "0":
        return "disabled"
    if normalized_value == "1":
        return "flexible"
    if normalized_value == "2":
        return "strict"
    return normalized_value or "flexible"


def _normalize_source_config(raw_config):
    channels = raw_config.get("channels", [])
    channels = [str(item) for item in channels if isinstance(item, str)]

    default_channels = raw_config.get("default_channels", [])
    normalized_default_channels = []
    for item in default_channels:
        normalized_item = _normalize_channel_value(item)
        if normalized_item:
            normalized_default_channels.append(normalized_item)

    channel_priority = _normalize_channel_priority(raw_config.get("channel_priority", "flexible"))

    return {
        "channels": channels,
        "default_channels": normalized_default_channels,
        "custom_channels": _normalize_custom_channels(raw_config.get("custom_channels", {})),
        "channel_priority": channel_priority,
        "config_file": _get_user_condarc_path(),
        "available_presets": sorted(SOURCE_PRESETS.keys()),
    }


def _strip_managed_source_sections(raw_content):
    lines = raw_content.splitlines()
    kept_lines = []
    index = 0

    while index < len(lines):
        line = lines[index]
        stripped_line = line.lstrip()
        indent = len(line) - len(stripped_line)

        if indent == 0 and stripped_line and ":" in stripped_line:
            key = stripped_line.split(":", 1)[0].strip()
            if key in MANAGED_SOURCE_KEYS:
                index += 1
                while index < len(lines):
                    next_line = lines[index]
                    next_stripped = next_line.lstrip()
                    next_indent = len(next_line) - len(next_stripped)

                    if next_stripped == "":
                        index += 1
                        continue

                    if next_indent == 0:
                        break

                    index += 1
                continue

        kept_lines.append(line)
        index += 1

    while kept_lines and kept_lines[-1].strip() == "":
        kept_lines.pop()

    return "\n".join(kept_lines)


def _render_source_preset_yaml(preset):
    lines = [f"channel_priority: {preset['channel_priority']}", "channels:"]

    for channel in preset["channels"]:
        lines.append(f"  - {channel}")

    if preset["default_channels"]:
        lines.append("default_channels:")
        for channel_url in preset["default_channels"]:
            lines.append(f"  - {channel_url}")

    if preset["custom_channels"]:
        lines.append("custom_channels:")
        for channel_name, channel_url in preset["custom_channels"].items():
            lines.append(f"  {channel_name}: {channel_url}")

    return "\n".join(lines)


def _read_source_config_from_condarc():
    condarc_path = _get_user_condarc_path()
    if not os.path.exists(condarc_path):
        return None

    parsed_config = {
        "channels": [],
        "default_channels": [],
        "custom_channels": {},
        "channel_priority": "flexible",
    }
    current_section = None

    with open(condarc_path, "r", encoding="utf-8") as handle:
        for raw_line in handle:
            stripped_line = raw_line.strip()
            if not stripped_line or stripped_line.startswith("#"):
                continue

            indent = len(raw_line) - len(raw_line.lstrip(" "))
            if indent == 0:
                current_section = None

                if stripped_line.startswith("channel_priority:"):
                    parsed_config["channel_priority"] = stripped_line.split(":", 1)[1].strip()
                elif stripped_line == "channels:":
                    current_section = "channels"
                elif stripped_line == "default_channels:":
                    current_section = "default_channels"
                elif stripped_line == "custom_channels:":
                    current_section = "custom_channels"

                continue

            if current_section in {"channels", "default_channels"} and stripped_line.startswith("- "):
                parsed_config[current_section].append(stripped_line[2:].strip())
                continue

            if current_section == "custom_channels" and ":" in stripped_line:
                channel_name, channel_url = stripped_line.split(":", 1)
                parsed_config["custom_channels"][channel_name.strip()] = channel_url.strip()

    return parsed_config


def _write_source_preset(preset):
    condarc_path = _get_user_condarc_path()
    existing_content = ""
    if os.path.exists(condarc_path):
        with open(condarc_path, "r", encoding="utf-8") as handle:
            existing_content = handle.read()

    preserved_content = _strip_managed_source_sections(existing_content)
    rendered_source_content = _render_source_preset_yaml(preset)

    merged_sections = []
    if preserved_content.strip():
        merged_sections.append(preserved_content.strip())
    merged_sections.append(rendered_source_content)

    final_content = "\n\n".join(merged_sections).rstrip() + "\n"
    with open(condarc_path, "w", encoding="utf-8") as handle:
        handle.write(final_content)


def _get_source_config(command_name):
    condarc_config = _read_source_config_from_condarc()
    if condarc_config is not None:
        return True, _normalize_source_config(condarc_config)

    condarc_path = _get_user_condarc_path()
    conda_success, conda_config_data = _run_json_command([
        _get_conda_cli_path(),
        "config",
        "--file",
        condarc_path,
        "--show",
        "channels",
        "channel_priority",
        "default_channels",
        "custom_channels",
        "--json",
    ])
    if conda_success:
        return True, _normalize_source_config(conda_config_data)

    success, config_data = run_package_manager_command_for_json(["config", "list", "--json"], command_name)
    if not success:
        return False, None
    return True, _normalize_source_config(config_data)


def _get_conda_meta_dir(env_path):
    return os.path.join(env_path, "conda-meta")


def _get_package_version_from_conda_meta(env_path, package_name):
    conda_meta_dir = _get_conda_meta_dir(env_path)
    if not os.path.isdir(conda_meta_dir):
        return None

    try:
        prefix = f"{package_name}-"
        for entry in os.scandir(conda_meta_dir):
            if not entry.is_file() or not entry.name.startswith(prefix) or not entry.name.endswith(".json"):
                continue

            with open(entry.path, "r", encoding="utf-8") as handle:
                metadata = json.load(handle)

            version = metadata.get("version")
            if version:
                return str(version)
    except Exception as e:
        log(f"Could not read {package_name} metadata for '{os.path.basename(env_path)}': {e}", stream="stderr")

    return None


def _normalize_probe_data(raw_data):
    root_prefix = raw_data.get("root_prefix")
    if not root_prefix:
        env_location = raw_data.get("env location")
        if isinstance(env_location, str) and os.path.isdir(env_location):
            root_prefix = env_location

    if not root_prefix:
        active_environment = raw_data.get("environment")
        if isinstance(active_environment, str):
            normalized_environment = active_environment.removesuffix(" (active)")
            if os.path.isdir(normalized_environment):
                root_prefix = normalized_environment

    if not root_prefix:
        base_environment = raw_data.get("base environment")
        if isinstance(base_environment, str) and os.path.isdir(base_environment):
            root_prefix = base_environment

    conda_version = raw_data.get("conda_version")
    if not conda_version and root_prefix:
        conda_version = _get_package_version_from_conda_meta(root_prefix, "conda")

    if not conda_version:
        conda_version = raw_data.get("micromamba version") or raw_data.get("libmamba version") or "unknown"

    python_version = raw_data.get("python_version")
    if not python_version and root_prefix:
        python_version = _get_package_version_from_conda_meta(root_prefix, "python")

    return {
        "conda_version": str(conda_version),
        "python_version": str(python_version or "N/A"),
        "root_prefix": str(root_prefix or ""),
    }


def cmd_probe(args):
    success, data = run_package_manager_command_for_json(["info", "--json"], "probe")
    if success:
        emit_result("probe", {"ok": True, "data": _normalize_probe_data(data)})


def cmd_diagnostics(args):
    success, info_data = run_package_manager_command_for_json(["info", "--json"], "diagnostics")
    if not success:
        return

    normalized_probe = _normalize_probe_data(info_data)
    package_manager_path = get_package_manager_path() or ""
    package_manager_kind = get_package_manager_kind()

    environment_label = info_data.get("environment")
    active_environment = ""
    if isinstance(environment_label, str):
        active_environment = environment_label.removesuffix(" (active)")

    envs_directories = info_data.get("envs directories")
    if not isinstance(envs_directories, list):
        envs_directories = info_data.get("envs_dirs", [])
    envs_directories = [str(item) for item in envs_directories if isinstance(item, str)]

    package_cache_directories = info_data.get("package cache")
    if not isinstance(package_cache_directories, list):
        package_cache_directories = info_data.get("pkgs_dirs", [])
    package_cache_directories = [str(item) for item in package_cache_directories if isinstance(item, str)]

    config_files = []
    for key in ["config_files", "populated config files", "user config files"]:
        value = info_data.get(key)
        if isinstance(value, list):
            config_files.extend(str(item) for item in value if isinstance(item, str))

    deduped_config_files = []
    seen_config_files = set()
    for config_path in config_files:
        normalized_path = os.path.normpath(config_path)
        if normalized_path in seen_config_files:
            continue
        seen_config_files.add(normalized_path)
        deduped_config_files.append(normalized_path)

    channels = info_data.get("channels", [])
    if not isinstance(channels, list):
        channels = []
    channels = [str(item) for item in channels if isinstance(item, str)]

    proxy_servers = {}
    raw_proxy_servers = info_data.get("proxy_servers")
    if isinstance(raw_proxy_servers, dict):
        proxy_servers = {str(key): str(value) for key, value in raw_proxy_servers.items() if value}

    ssl_verify = info_data.get("ssl_verify")
    if ssl_verify is None:
        ssl_verify = info_data.get("env_vars", {}).get("SSL_VERIFY")

    diagnostics_data = {
        "package_manager_kind": package_manager_kind,
        "package_manager_path": str(package_manager_path),
        "conda_version": normalized_probe["conda_version"],
        "python_version": normalized_probe["python_version"],
        "root_prefix": normalized_probe["root_prefix"],
        "active_environment": active_environment,
        "envs_directories": envs_directories,
        "package_cache_directories": package_cache_directories,
        "config_files": deduped_config_files,
        "channels": channels,
        "proxy_servers": proxy_servers,
        "ssl_verify": ssl_verify,
    }

    emit_result("diagnostics", {"ok": True, "data": diagnostics_data})


def cmd_source_config_get(args):
    success, source_config = _get_source_config("source-config-get")
    if success:
        emit_result("source-config-get", {"ok": True, "data": source_config})


def cmd_source_config_apply_preset(args):
    preset_name = args.preset.lower()
    preset = SOURCE_PRESETS.get(preset_name)
    if not preset:
        emit_result("source-config-apply-preset", {"ok": False, "error": f"Unknown preset: {args.preset}"})
        return

    try:
        _write_source_preset(preset)
    except Exception as e:
        emit_result("source-config-apply-preset", {"ok": False, "error": str(e) or "Failed to update source config"})
        return

    success, source_config = _get_source_config("source-config-apply-preset")
    if success:
        emit_result("source-config-apply-preset", {"ok": True, "data": source_config})


def cmd_env_list(args):
    success, data = run_package_manager_command_for_json(["env", "list", "--json"], "env-list")
    if not success:
        return

    raw_env_paths = data.get("envs", [])
    env_paths = []
    seen_env_paths = set()

    for env_path in raw_env_paths:
        if not isinstance(env_path, str):
            continue

        normalized_env_path = os.path.normpath(env_path)
        if normalized_env_path in seen_env_paths:
            continue

        if not os.path.isdir(normalized_env_path):
            continue

        seen_env_paths.add(normalized_env_path)
        env_paths.append(normalized_env_path)

    def _probe_python_version(env_path):
        python_version = _get_package_version_from_conda_meta(env_path, "python")
        if python_version:
            return {"path": env_path, "python_version": python_version}

        python_version = "N/A"
        try:
            python_exe = os.path.join(env_path, "python.exe") if sys.platform == "win32" else os.path.join(env_path, "bin", "python")
            if not os.path.exists(python_exe):
                return {"path": env_path, "python_version": python_version}
            py_version_proc = subprocess.run([python_exe, "--version"], capture_output=True, text=True, timeout=2, encoding="utf-8", check=True)
            output = py_version_proc.stdout.strip() or py_version_proc.stderr.strip()
            if "Python" in output:
                python_version = output.split()[-1]
        except Exception as e:
            log(f"Could not get Python version for '{os.path.basename(env_path)}': {e}", stream="stderr")
        return {"path": env_path, "python_version": python_version}

    if not env_paths:
        log("'env-list' (with Python versions) successful.")
        emit_result("env-list", {"ok": True, "data": []})
        return

    max_workers = min(8, len(env_paths))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        enriched_envs = list(executor.map(_probe_python_version, env_paths))

    log("'env-list' (with Python versions) successful.")
    emit_result("env-list", {"ok": True, "data": enriched_envs})


def cmd_pkg_list(args):
    conda_meta_dir = os.path.join(args.prefix, "conda-meta")
    if os.path.isdir(conda_meta_dir):
        packages = []
        try:
            for entry in os.scandir(conda_meta_dir):
                if not entry.is_file() or not entry.name.endswith(".json"):
                    continue

                with open(entry.path, "r", encoding="utf-8") as handle:
                    metadata = json.load(handle)

                name = metadata.get("name")
                version = metadata.get("version")
                if not name or not version:
                    continue

                packages.append({
                    "name": str(name),
                    "version": str(version),
                    "build": str(metadata.get("build", "")),
                    "channel": str(metadata.get("channel", "")),
                })

            packages.sort(key=lambda pkg: pkg["name"].lower())
            emit_result("pkg-list", {"ok": True, "data": packages})
            return
        except Exception as e:
            log(f"Could not read package metadata for '{args.prefix}': {e}", stream="stderr")

    success, data = run_package_manager_command_for_json(["list", "--prefix", args.prefix, "--json"], "pkg-list")
    if success:
        emit_result("pkg-list", {"ok": True, "data": data})


def cmd_env_create(args):
    stream_package_manager_command(["create", "--name", args.name, f"python={args.python}", "--yes"], "env-create")


def cmd_env_remove(args):
    stream_package_manager_command(["env", "remove", "--prefix", args.prefix, "--yes"], "env-remove")


def cmd_env_rename(args):
    clone_success = stream_package_manager_command(["create", "--name", args.new_name, "--clone", args.old_prefix, "--yes"], "env-rename", emit_final_result=False)
    if not clone_success:
        emit_result("env-rename", {"ok": False, "error": "Cloning step failed."})
        return

    remove_success = stream_package_manager_command(["env", "remove", "--prefix", args.old_prefix, "--yes"], "env-rename", emit_final_result=False)
    if not remove_success:
        emit_result("env-rename", {"ok": False, "error": "Clone succeeded, but remove step failed."})
        return

    emit_result("env-rename", {"ok": True})


def cmd_env_export(args):
    try:
        package_manager_path = get_package_manager_path()
        if not package_manager_path:
            raise Exception("package manager init failed: executable not found")

        cmd = [package_manager_path]
        output = ""

        if args.format == "yml":
            export_cmd = ["env", "export", "--name", args.name]
            if args.no_builds:
                export_cmd.append("--no-builds")
            cmd.extend(export_cmd)
            proc = subprocess.run(cmd, capture_output=True, text=True, check=True, encoding="utf-8")
            lines = proc.stdout.splitlines()
            cleaned_lines = [line for line in lines if not line.startswith("prefix:")]
            output = "\n".join(cleaned_lines)

        elif args.format == "txt":
            export_cmd = ["list", "--export", "--name", args.name]
            cmd.extend(export_cmd)
            proc = subprocess.run(cmd, capture_output=True, text=True, check=True, encoding="utf-8")
            output = proc.stdout
            if args.no_builds:
                lines = output.splitlines()
                processed_lines = [re.sub(r"=[^=]*$", "", line) for line in lines if not line.startswith("#")]
                output = "\n".join(processed_lines)

        with open(args.file, "w", encoding="utf-8") as f:
            f.write(output)
        emit_result("env-export", {"ok": True})
    except Exception as e:
        error_message = str(e)
        if isinstance(e, subprocess.CalledProcessError):
            error_message = e.stderr.strip() or e.stdout.strip()
        emit_result("env-export", {"ok": False, "error": error_message})


def cmd_env_import(args):
    stream_package_manager_command(["env", "create", "--file", args.file, "--name", args.name, "--yes"], "env-import")


def cmd_env_clone(args):
    stream_package_manager_command(["create", "--name", args.dest_name, "--clone", args.source_prefix, "--yes"], "env-clone")
