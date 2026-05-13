#!/usr/bin/env python3
import argparse
from CondaTool_conda.commands import (
    cmd_probe,
    cmd_diagnostics,
    cmd_source_config_get,
    cmd_source_config_apply_preset,
    cmd_source_config_add_channel,
    cmd_source_config_remove_channel,
    cmd_source_config_move_channel,
    cmd_proxy_get,
    cmd_proxy_set,
    cmd_proxy_clear,
    cmd_env_list,
    cmd_pkg_list,
    cmd_env_create,
    cmd_env_remove,
    cmd_env_rename,
    cmd_env_export,
    cmd_env_import,
    cmd_env_clone,
    cmd_pkg_install,
    cmd_pkg_remove,
    cmd_pkg_upgrade,
    cmd_pkg_upgrade_all,
    cmd_pkg_search,
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

    add_channel_parser = sub.add_parser("source-config-add-channel", help="Add a channel to the channel list")
    add_channel_parser.add_argument("--channel", required=True)
    add_channel_parser.set_defaults(func=cmd_source_config_add_channel)

    remove_channel_parser = sub.add_parser("source-config-remove-channel", help="Remove a channel from the channel list")
    remove_channel_parser.add_argument("--channel", required=True)
    remove_channel_parser.set_defaults(func=cmd_source_config_remove_channel)

    move_channel_parser = sub.add_parser("source-config-move-channel", help="Move a channel up or down")
    move_channel_parser.add_argument("--channel", required=True)
    move_channel_parser.add_argument("--direction", required=True, choices=["up", "down"])
    move_channel_parser.set_defaults(func=cmd_source_config_move_channel)

    # Proxy configuration
    sub.add_parser("proxy-get", help="Read proxy configuration").set_defaults(func=cmd_proxy_get)

    proxy_set_parser = sub.add_parser("proxy-set", help="Set proxy configuration")
    proxy_set_parser.add_argument("--http", required=False, default="")
    proxy_set_parser.add_argument("--https", required=False, default="")
    proxy_set_parser.add_argument("--ssl-verify", required=False, default=None)
    proxy_set_parser.set_defaults(func=cmd_proxy_set)

    proxy_clear_parser = sub.add_parser("proxy-clear", help="Clear proxy configuration")
    proxy_clear_parser.add_argument("--ssl-verify", required=False, default=None)
    proxy_clear_parser.set_defaults(func=cmd_proxy_clear)

    sub.add_parser("env-list", help="List all environments").set_defaults(func=cmd_env_list)

    # Package info
    pkg_parser = sub.add_parser("pkg-list", help="List packages in an environment")
    pkg_parser.add_argument("--prefix", required=True)
    pkg_parser.set_defaults(func=cmd_pkg_list)

    pkg_install_parser = sub.add_parser("pkg-install", help="Install a package into an environment")
    pkg_install_parser.add_argument("--prefix", required=True)
    pkg_install_parser.add_argument("--name", required=True)
    pkg_install_parser.add_argument("--version", required=False)
    pkg_install_parser.set_defaults(func=cmd_pkg_install)

    pkg_remove_parser = sub.add_parser("pkg-remove", help="Remove a package from an environment")
    pkg_remove_parser.add_argument("--prefix", required=True)
    pkg_remove_parser.add_argument("--name", required=True)
    pkg_remove_parser.set_defaults(func=cmd_pkg_remove)

    pkg_upgrade_parser = sub.add_parser("pkg-upgrade", help="Upgrade a package in an environment")
    pkg_upgrade_parser.add_argument("--prefix", required=True)
    pkg_upgrade_parser.add_argument("--name", required=True)
    pkg_upgrade_parser.set_defaults(func=cmd_pkg_upgrade)

    pkg_upgrade_all_parser = sub.add_parser("pkg-upgrade-all", help="Upgrade all packages in an environment")
    pkg_upgrade_all_parser.add_argument("--prefix", required=True)
    pkg_upgrade_all_parser.set_defaults(func=cmd_pkg_upgrade_all)

    pkg_search_parser = sub.add_parser("pkg-search", help="Search for packages in remote channels")
    pkg_search_parser.add_argument("--query", required=True)
    pkg_search_parser.set_defaults(func=cmd_pkg_search)

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
