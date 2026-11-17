#!/usr/bin/env bash
# Resets the testnet demo for another recording take without redeploying.
#   ./scripts/reset-demo.sh            return all agent float and give each agent a fresh day of cap room
#   ./scripts/reset-demo.sh --restore  put daily caps back to the deploy.sh values (run after recording)
# Payments, vault share value and agent history are kept: they only ever grow, which is fine on camera.
set -euo pipefail

cd "$(dirname "$0")/.."
NET=testnet
USDC=10000000 # 7 decimals
DAILY_FLOAT_CAP=$((1500 * USDC))
DAILY_CASHOUT_CAP=$((2000 * USDC))
CONTRACT=$(jq -r .contractId deployments/testnet.json)

view() {
  stellar contract invoke --id "$CONTRACT" --source sayola-admin --network "$NET" --send=no -- "$@"
}
call() {
  local src=$1; shift
  stellar contract invoke --id "$CONTRACT" --source "sayola-$src" --network "$NET" -- "$@" >/dev/null
}

TODAY=$(view today)

for name in agent-idlib agent-aleppo; do
  addr=$(stellar keys address "sayola-$name")
  agent=$(view get_agent --agent "$addr")
  limit=$(jq -r .limit <<<"$agent")
  float_out=$(jq -r .float_out <<<"$agent")

  if [[ "${1:-}" == "--restore" ]]; then
    float_cap=$DAILY_FLOAT_CAP
    cashout_cap=$DAILY_CASHOUT_CAP
  else
    if ((float_out > 0)); then
      call "$name" return_float --agent "$addr" --amount "$float_out"
    fi
    usage=$(view get_agent_day --agent "$addr" --day "$TODAY")
    # Returned float and past bookings still count today, so lift the caps by what has been used.
    float_cap=$((DAILY_FLOAT_CAP + $(jq -r .float_taken <<<"$usage")))
    cashout_cap=$((DAILY_CASHOUT_CAP + $(jq -r .cashout_committed <<<"$usage")))
  fi

  call admin set_agent --agent "$addr" --limit "$limit" \
    --daily_float_cap "$float_cap" --daily_cashout_cap "$cashout_cap" --active true
  echo "$name: float returned $((float_out / USDC)), daily float cap \$$((float_cap / USDC)), daily cash-out cap \$$((cashout_cap / USDC))"
done
