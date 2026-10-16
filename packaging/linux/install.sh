#!/bin/sh
set -eu

fail() { printf 'Erro: %s\n' "$*" >&2; exit 1; }
[ "$(uname -s)" = Linux ] || fail 'Este instalador é para Linux.'
bundle_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
if [ "$#" = 0 ]; then
  app_data_root=${XDG_DATA_HOME:-"$HOME/.local/share"}
  app_bin_dir="$HOME/.local/bin"
elif [ "$#" = 2 ] && [ "$1" = --prefix ]; then
  case "$2" in /*) ;; *) fail 'O prefixo precisa ser um caminho absoluto.' ;; esac
  app_data_root="$2/share"
  app_bin_dir="$2/bin"
else
  printf 'Uso: %s [--prefix /caminho/absoluto]\n' "$0" >&2
  exit 1
fi
case "$app_data_root" in /*) ;; *) fail 'XDG_DATA_HOME precisa ser um caminho absoluto.' ;; esac
case "$app_data_root$app_bin_dir" in *'
'*) fail 'O caminho não pode conter quebras de linha.' ;; esac
app_source=${ENTRELINHAS_SOURCE_DIR:-"$bundle_dir/app"}
app_icon=${ENTRELINHAS_ICON_FILE:-"$bundle_dir/icon.png"}
app_version=${ENTRELINHAS_VERSION:-$(cat "$bundle_dir/VERSION")}
case "$app_version" in ''|*[!0-9a-zA-Z.+-]*) fail 'Versão inválida.' ;; esac
[ -f "$app_source/entrelinhas" ] || fail 'Aplicativo não encontrado. Extraia o pacote completo antes de instalar.'
[ -f "$app_icon" ] || fail 'Ícone não encontrado.'
app_root="$app_data_root/entrelinhas"
app_entries="$app_data_root/applications"
app_icons="$app_data_root/icons/hicolor"
mkdir -p "$app_root/versions" "$app_entries" "$app_icons/512x512/apps" "$app_bin_dir"
app_stage=$(mktemp -d "$app_root/versions/.install.XXXXXXXX")
trap 'if [ -n "${app_stage:-}" ]; then rm -rf -- "$app_stage"; fi' EXIT HUP INT TERM
cp -R -- "$app_source/." "$app_stage/"
chmod u+x "$app_stage/entrelinhas"
app_destination="$app_root/versions/$app_version-$(basename "$app_stage" | sed 's/^\.install\.//')"
mv -- "$app_stage" "$app_destination"
app_stage=''
app_launcher="$app_bin_dir/entrelinhas"
shell_quote() { printf "'"; printf '%s' "$1" | sed "s/'/'\\\\''/g"; printf "'"; }
{
  printf '#!/bin/sh\nunset ELECTRON_RUN_AS_NODE\nexec '
  shell_quote "$app_destination/entrelinhas"
  printf ' --class=com.entrelinhas.reader "$@"\n'
} > "$app_launcher.tmp"
chmod 755 "$app_launcher.tmp"
mv -- "$app_launcher.tmp" "$app_launcher"
cp -- "$app_icon" "$app_icons/512x512/apps/entrelinhas.png"
app_exec=$(printf '%s' "$app_launcher" | sed 's/\\/\\\\/g;s/"/\\"/g;s/`/\\`/g;s/\$/\\$/g;s/%/%%/g')
cat > "$app_entries/com.entrelinhas.reader.desktop" <<DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=Entrelinhas
GenericName=Leitor e editor de Markdown
Comment=Leia e edite Markdown com abas, Mermaid e retomada da sessão
Exec="$app_exec" %F
Icon=entrelinhas
Terminal=false
Categories=Office;
MimeType=text/markdown;text/x-markdown;
Keywords=Markdown;MD;Mermaid;leitor;editor;notas;
StartupNotify=true
StartupWMClass=com.entrelinhas.reader
DESKTOP
chmod 644 "$app_entries/com.entrelinhas.reader.desktop"
if command -v desktop-file-validate >/dev/null 2>&1; then desktop-file-validate "$app_entries/com.entrelinhas.reader.desktop"; fi
if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database "$app_entries" || true; fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then gtk-update-icon-cache -f -t "$app_icons" >/dev/null 2>&1 || true; fi
printf 'Entrelinhas %s instalado. Procure Entrelinhas no menu de aplicativos.\n' "$app_version"
