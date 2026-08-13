#!/usr/bin/env bash
#
# The manual checklist from DESIGN-CHECK.md, as something you can re-run.
#
#   npm run design-check           source checks, fast
#   npm run design-check -- --build  also proves the banned utilities cannot compile
#
# Exits non-zero if anything is flagged.

set -uo pipefail
cd "$(dirname "$0")/.."

FAIL=0
BUILD=0
[ "${1:-}" = "--build" ] && BUILD=1

pass() { printf '  ok    %s\n' "$1"; }
flag() { printf '  FLAG  %s\n' "$1"; FAIL=1; }

# A Tailwind colour utility is <prefix>-<palette>-<shade>. Anchoring on the
# prefix matters: a bare "slate-" pattern also matches -translate-y-1/2, which
# is why an unanchored grep reports phantom leaks.
PREFIX='(bg|text|border|ring|from|via|to|divide|placeholder|accent|caret|decoration|outline|shadow|fill|stroke)'
PALETTE='(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)'

check() {
  local label="$1" pattern="$2"
  local hits
  hits=$(grep -rEn --include='*.tsx' --include='*.ts' --include='*.css' "$pattern" src/ 2>/dev/null | grep -v '^\s*//' || true)
  if [ -n "$hits" ]; then
    flag "$label"
    printf '%s\n' "$hits" | sed 's/^/          /'
  else
    pass "$label"
  fi
}

echo
echo "Tokens, not defaults"
check "no Tailwind palette utilities"  "(^|[[:space:]\"'\`:])${PREFIX}-${PALETTE}-(50|[1-9]00|950)\b"
check "no bg-white / text-black"       "(^|[[:space:]\"'\`:])(bg|text|border)-(white|black)\b"

echo
echo "Hierarchy from spacing and colour"
check "no weight escalation"           "font-(bold|semibold|extrabold|black)\b"

echo
echo "No AI tells"
check "no shadows"                     "shadow-(sm|md|lg|xl|2xl)\b"
check "no gradients or glass"          "(bg-gradient|backdrop-blur|bg-clip-text)"
check "no skeleton shimmer"            "(animate-pulse|skeleton|shimmer)"

# Emoji need -P for \x{...} ranges; -E would treat the escape literally and
# match every line in the file.
emoji=$(grep -rnP --include='*.tsx' --include='*.ts' --include='*.css' \
  '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{FE0F}\x{2190}-\x{21FF}]' src/ 2>/dev/null || true)
if [ -n "$emoji" ]; then
  flag "no emoji as UI icons"
  printf '%s\n' "$emoji" | sed 's/^/          /'
else
  pass "no emoji as UI icons"
fi

echo
echo "Radius discipline"
check "nothing rounder than --radius-ui" "rounded-(xl|2xl|3xl|full)\b"

echo
echo "Copy"
check "no lorem / Get Started / Submit" "(Lorem ipsum|lorem ipsum|Get Started|>Submit<)"

echo
echo "Density"
# Tap targets: every interactive element should declare a 44px floor
# somewhere in its class list, or inherit one from a component that does.
if grep -rn "min-h-\[44px\]" src/ >/dev/null 2>&1; then
  pass "44px tap-target floor in use ($(grep -rc "min-h-\[44px\]" src/ | awk -F: '{s+=$2} END {print s}') declarations)"
else
  flag "no 44px tap targets declared"
fi

if [ "$BUILD" = "1" ]; then
  echo
  echo "Compile-time lockdown"
  probe="src/__design_check_probe.tsx"
  cat > "$probe" <<'EOF'
export const Probe = () => (
  <div className="bg-gray-100 text-slate-500 bg-blue-500 text-indigo-600 bg-white text-black" />
)
EOF
  npx vite build --logLevel error >/dev/null 2>&1
  rm -f "$probe"
  css=$(ls -t dist/assets/index-*.css 2>/dev/null | head -1)
  if [ -z "$css" ]; then
    flag "could not find built CSS to inspect"
  else
    leaked=""
    for c in bg-gray-100 text-slate-500 bg-blue-500 text-indigo-600 bg-white text-black; do
      grep -q "\.${c}\b" "$css" && leaked="$leaked $c"
    done
    if [ -n "$leaked" ]; then
      flag "banned utilities compiled:$leaked"
    else
      pass "banned utilities do not compile (palette namespace is wiped)"
    fi
  fi
fi

echo
echo "Contrast (reported, not enforced — the tokens are law)"
node scripts/contrast.mjs | sed '/^$/d'

if command -v npx >/dev/null 2>&1; then
  echo
  echo "impeccable detectors"
  if out=$(npx --no-install impeccable detect src/ index.html 2>/dev/null); then
    if [ -n "$out" ]; then
      flag "impeccable found anti-patterns"
      printf '%s\n' "$out" | sed 's/^/          /'
    else
      pass "no anti-patterns detected"
    fi
  else
    echo "  skip  impeccable not installed locally (npx --yes impeccable detect src/)"
  fi
fi

echo
if [ "$FAIL" = "0" ]; then
  echo "Design check passed."
else
  echo "Design check flagged something above."
fi
exit $FAIL
