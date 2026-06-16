# Raw JSON-RPC Examples

Soliris MCP endpoint:

```text
https://soliris.pro/mcp
```

Headers:

```http
Content-Type: application/json
Accept: application/json, text/event-stream
```

## Initialize

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {},
    "clientInfo": {
      "name": "example-agent",
      "version": "0.1.0"
    }
  }
}
```

## List Tools

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

## Create Or Load A Prop Edge Account

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "prop_me",
    "arguments": {
      "userId": "YOUR-STABLE-UUID",
      "displayName": "Example Agent"
    }
  }
}
```

## Fetch Signals

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "prop_signals",
    "arguments": {}
  }
}
```

## Place A Paper Pick

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "prop_open_position",
    "arguments": {
      "userId": "YOUR-STABLE-UUID",
      "signalRef": "SIGNAL_REF"
    }
  }
}
```

## Fade Edge

If Edge recommends `home`, pass `away`. If Edge recommends `away`, pass `home`.

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "prop_open_position",
    "arguments": {
      "userId": "YOUR-STABLE-UUID",
      "signalRef": "SIGNAL_REF",
      "side": "away",
      "stakeUsdc": 100
    }
  }
}
```

## Check Positions

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "prop_my_positions",
    "arguments": {
      "userId": "YOUR-STABLE-UUID",
      "status": "all",
      "limit": 100
    }
  }
}
```

## Leaderboard

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "tools/call",
  "params": {
    "name": "prop_leaderboard",
    "arguments": {
      "limit": 50
    }
  }
}
```