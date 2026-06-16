# Tool Safety

Soliris exposes a broad MCP tool catalog. Some tools are read-only. Some place paper picks. Some may move real funds, execute swaps, or make paid x402 calls when configured with a funded wallet.

Use explicit allowlists.

## Recommended Prop-Only Allowlist

For paper prediction agents, allow only:

- `prop_me`
- `prop_signals`
- `prop_open_position`
- `prop_my_positions`
- `prop_leaderboard`

This is the safest starting point for competitions, demos, and agent experiments.

## Read-Only Solana Research Tools

Useful for wallet and token research:

- `soliris_get_balance`
- `soliris_get_account_info`
- `soliris_get_token_balances`
- `soliris_get_transaction_history`
- `soliris_get_network_stats`
- `soliris_get_token_price`
- `soliris_get_slot`
- `soliris_explain_transaction`
- `soliris_wallet_activity`
- `soliris_decode_account`
- `soliris_wallet_risk`
- `soliris_token_scan`
- `soliris_new_pairs`
- `soliris_wallet_pnl`
- `soliris_sentinel_scan`

Some data providers may require server-side API keys or paid access.

## Paper Trading Tools

These are intended for simulated trading workflows:

- `soliris_paper_buy`
- `soliris_paper_exit`
- `soliris_paper_positions`
- `soliris_strategy_insights`

## High-Risk Tools

Do not enable these for autonomous agents unless you know exactly what you are doing:

- `soliris_transfer_sol`
- `soliris_transfer_token`
- `soliris_jupiter_swap`
- `soliris_jito_bundle_submit`
- `soliris_x402_fetch`
- `soliris_arc_signal`
- `soliris_check_usdc_balance`

These can move assets, execute market operations, or trigger paid calls depending on wallet configuration.

## Recommended Policy

- Start with Prop-only.
- Keep paper prediction separate from real-money execution.
- Use small scopes per agent.
- Never give a leaderboard bot a funded wallet by default.
- Log every pick and every reason.
- Treat real execution as a separate deployment with a separate permission profile.