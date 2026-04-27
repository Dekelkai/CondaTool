#!/usr/bin/env python3
import argparse
from CondaTool_conda.commands import (
    cmd_probe,
    cmd_diagnostics,
    cmd_source_config_get,
    cmd_source_config_apply_preset,
    cmd_env_list,
    cmd_pkg_list,
    cmd_env_create,
    cmd_env_remove,
    cmd_env_rename,
    cmd_env_export,
    cmd_env_import,
    cmd_env_clone,
)
from CondaTool_conda.utils import set_package_manager_path


def main():
    parser = argparse.ArgumentParser(prog="CondaTool-backend")
    parser.add_argument("--package-manager", required=False, help="Path to package manager executable (micromamba/conda)")
    sub = parser.add_subparsers(dest="command", required=True)

    # Environment info
    sub.add_parser("probe", help="Probe package manager availability").set_defaults(func=cmd_probe)
    sub.add_parser("diagnostics", help="Collect package manager diagnostics").set_defaults(func=cmd_diagnostics)
    sub.add_parser("source-config-get", help="Read source/channel configuration").set_defaults(func=cmd_source_config_get)

    source_preset_parser = sub.add_parser("source-config-apply-preset", help="Apply a predefined source configuration preset")
    source_preset_parser.add_argument("--preset", required=True)
    source_preset_parser.set_defaults(func=cmd_source_config_apply_preset)

    sub.add_parser("env-list", help="List all environments").set_defaults(func=cmd_env_list)

    # Package info
    pkg_parser = sub.add_parser("pkg-list", help="List packages in an environment")
    pkg_parser.add_argument("--prefix", required=True)
    pkg_parser.set_defaults(func=cmd_pkg_list)

    # Environment management
    create_parser = sub.add_parser("env-create", help="Create a new environment")
    create_parser.add_argument("--name", required=True)
    create_parser.add_argument("--python", required=True)
    create_parser.set_defaults(func=cmd_env_create)

    remove_parser = sub.add_parser("env-remove", help="Remove an environment")
    remove_parser.add_argument("--prefix", required=True)
    remove_parser.set_defaults(func=cmd_env_remove)

    rename_parser = sub.add_parser("env-rename", help="Rename an environment")
    rename_parser.add_argument("--old-prefix", required=True)
    rename_parser.add_argument("--new-name", required=True)
    rename_parser.set_defaults(func=cmd_env_rename)

    export_parser = sub.add_parser("env-export", help="Export an environment to a file")
    export_parser.add_argument("--name", required=True)
    export_parser.add_argument("--file", required=True)
    export_parser.add_argument("--format", required=True, choices=["yml", "txt"])
    export_parser.add_argument("--no-builds", action="store_true")
    export_parser.set_defaults(func=cmd_env_export)

    import_parser = sub.add_parser("env-import", help="Import an environment from a file")
    import_parser.add_argument("--file", required=True)
    import_parser.add_argument("--name", required=True)
    import_parser.set_defaults(func=cmd_env_import)

    clone_parser = sub.add_parser("env-clone", help="Clone an existing environment")
    clone_parser.add_argument("--source-prefix", required=True)
    clone_parser.add_argument("--dest-name", required=True)
    clone_parser.set_defaults(func=cmd_env_clone)

    ns = parser.parse_args()
    set_package_manager_path(ns.package_manager)
    ns.func(ns)


if __name__ == "__main__":
    main()
