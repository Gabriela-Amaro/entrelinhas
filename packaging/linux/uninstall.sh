#!/bin/sh
set -eu
if [ "$#" = 0 ]; then
  app_data_root=${XDG_DATA_HOME:-"$HOME/.local/share"}
  app_bin_dir="$HOME/.local/bin"
elif [ "$#" = 2 ] && [ "$1" = --prefix ]; then
  case "$2" in /*) ;; *) printf 'Use um prefixo absoluto.\n' >&2; exit 1 ;; esac
  app_data_root="$2/share"
  app_bin_dir="$2/bin"
else
  printf 'Uso: %s [--prefix /caminho/absoluto]\n' "$0" >&2
  exit 1
fi
case "$app_data_root" in /*) ;; *) printf 'XDG_DATA_HOME inválido.\n' >&2; exit 1 ;; esac
rm -f -- "$app_bin_dir/entrelinhas" "$app_data_root/applications/com.entrelinhas.reader.desktop" "$app_data_root/icons/hicolor/512x512/apps/entrelinhas.png"
rm -rf -- "$app_data_root/entrelinhas"
if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database "$app_data_root/applications" || true; fi
printf 'Entrelinhas desinstalado. Sua sessão e seus documentos foram preservados.\n'
