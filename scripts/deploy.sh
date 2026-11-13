#!/usr/bin/env bash
# Deploys Sayola to Stellar testnet from scratch and seeds demo data.
# Safe to rerun after a testnet reset: identities are recreated and refunded.
set -euo pipefail

cd "$(dirname "$0")/.."
NET=testnet
export PATH="/opt/homebrew/opt/rustup/bin:$PATH"

USDC=10000000 # 7 decimals
DISPUTE_WINDOW=86400
NOTICE_PERIOD=300

IDS=(admin platform issuer ngo agent-idlib agent-aleppo recipient-1 recipient-2 recipient-3 investor)

echo "==> Creating and funding testnet identities"
for id in "${IDS[@]}"; do
  stellar keys generate "sayola-$id" --network "$NET" --fund --overwrite >/dev/null 2>&1
done
addr() { stellar keys address "sayola-$1"; }

ISSUER=$(addr issuer)
ASSET="USDC:$ISSUER"

echo "==> Creating mock USDC ($ASSET) and its Stellar Asset Contract"
for id in platform ngo agent-idlib agent-aleppo recipient-1 recipient-2 recipient-3 investor admin; do
  stellar tx new change-trust --source "sayola-$id" --line "$ASSET" --network "$NET" >/dev/null
done
TOKEN=$(stellar contract asset deploy --asset "$ASSET" --source sayola-issuer --network "$NET" --alias sayola-usdc 2>/dev/null || stellar contract id asset --asset "$ASSET" --network "$NET")

mint() {
  stellar contract invoke --id "$TOKEN" --source sayola-issuer --network "$NET" -- \
    mint --to "$(addr "$1")" --amount "$2" >/dev/null
}
mint ngo $((50000 * USDC))
mint investor $((20000 * USDC))
mint agent-idlib $((2000 * USDC))
mint agent-aleppo $((2000 * USDC))

echo "==> Building and deploying the Sayola contract"
stellar contract build --package sayola >/dev/null
CONTRACT=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/sayola.wasm \
  --source sayola-admin --network "$NET" --alias sayola -- \
  --admin "$(addr admin)" --token "$TOKEN" --platform "$(addr platform)" \
  --dispute_window "$DISPUTE_WINDOW" --notice_period "$NOTICE_PERIOD")

call() {
  local src=$1; shift
  stellar contract invoke --id "$CONTRACT" --source "sayola-$src" --network "$NET" -- "$@" >/dev/null
}

echo "==> Seeding agents, vault and payments"
call admin set_agent --agent "$(addr agent-idlib)" --limit $((5000 * USDC)) --active true
call admin set_agent --agent "$(addr agent-aleppo)" --limit $((3000 * USDC)) --active true
call agent-idlib post_collateral --agent "$(addr agent-idlib)" --amount $((500 * USDC))
call agent-aleppo post_collateral --agent "$(addr agent-aleppo)" --amount $((500 * USDC))
call investor deposit --investor "$(addr investor)" --assets $((10000 * USDC))
call agent-idlib take_float --agent "$(addr agent-idlib)" --amount $((1500 * USDC))

EXPIRES=$(( $(date +%s) + 30 * 86400 ))
for r in recipient-1 recipient-2 recipient-3; do
  # 378 USD multipurpose cash grant with a 2% cash-out fee paid by the NGO
  call ngo fund --ngo "$(addr ngo)" --recipient "$(addr "$r")" \
    --amount $((378 * USDC)) --fee $((756 * USDC / 100)) --expires_at "$EXPIRES"
done

echo "==> Writing deployments/testnet.json and app/.env.local"
mkdir -p deployments app
cat > deployments/testnet.json <<JSON
{
  "network": "testnet",
  "rpcUrl": "https://soroban-testnet.stellar.org",
  "networkPassphrase": "Test SDF Network ; September 2015",
  "contractId": "$CONTRACT",
  "tokenId": "$TOKEN",
  "asset": "$ASSET",
  "accounts": {
$(for id in "${IDS[@]}"; do printf '    "%s": "%s",\n' "$id" "$(addr "$id")"; done | sed '$ s/,$//')
  }
}
JSON

{
  echo "SAYOLA_CONTRACT_ID=$CONTRACT"
  echo "SAYOLA_TOKEN_ID=$TOKEN"
  for id in "${IDS[@]}"; do
    key=$(echo "$id" | tr 'a-z-' 'A-Z_')
    echo "SAYOLA_SECRET_$key=$(stellar keys secret "sayola-$id")"
  done
} > app/.env.local

echo
echo "Contract: $CONTRACT"
echo "Token:    $TOKEN"
echo "Explorer: https://stellar.expert/explorer/testnet/contract/$CONTRACT"
