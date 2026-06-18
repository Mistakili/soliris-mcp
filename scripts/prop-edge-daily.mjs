const MCP_URL = process.env.SOLIRIS_MCP_URL || 'https://soliris.pro/mcp';
const USER_ID = process.env.SOLIRIS_PROP_USER_ID;
const DISPLAY_NAME = process.env.SOLIRIS_PROP_DISPLAY_NAME || 'Codex Inspector';
const DRY_RUN = String(process.env.DRY_RUN || '').toLowerCase() === 'true';

if (!USER_ID) {
  throw new Error('Missing SOLIRIS_PROP_USER_ID. Add it as a GitHub Actions secret.');
}

let nextId = 1;

async function mcp(method, params = {}) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${raw.slice(0, 500)}`);

  const dataLine = raw
    .split(/\r?\n/)
    .find((line) => line.startsWith('data:'));
  const payload = JSON.parse((dataLine || raw).replace(/^data:\s*/, ''));
  if (payload.error) throw new Error(JSON.stringify(payload.error));
  return payload.result;
}

async function tool(name, args = {}) {
  const result = await mcp('tools/call', { name, arguments: args });
  const text = result?.content?.find((item) => item.type === 'text')?.text;
  return text ? JSON.parse(text) : result;
}

async function espnSummary(sport, gameId) {
  if (sport !== 'mlb' || !gameId) return null;
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${encodeURIComponent(gameId)}`;
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return { source: url, error: `ESPN HTTP ${res.status}` };
    const json = await res.json();
    const comp = json.header?.competitions?.[0];
    const competitors = comp?.competitors || [];
    const home = competitors.find((c) => c.homeAway === 'home');
    const away = competitors.find((c) => c.homeAway === 'away');
    const odds = comp?.odds?.[0] || json.pickcenter?.[0] || null;
    return {
      source: url,
      status: comp?.status?.type?.description,
      homeRecord: home?.record,
      awayRecord: away?.record,
      homeRank: home?.curatedRank?.current,
      awayRank: away?.curatedRank?.current,
      oddsSummary: odds?.details || odds?.summary || odds?.provider?.name || null,
      spread: odds?.spread ?? null,
      overUnder: odds?.overUnder ?? null,
    };
  } catch (error) {
    return { source: url, error: error.message };
  }
}

function positionSignalRefs(positions) {
  return new Set((positions || []).filter((p) => p.status === 'open').map((p) => p.signalRef));
}

function choose(signal, context, account) {
  const strength = signal.edgeStrength;
  const confidence = Number(signal.confidence || 0);
  const recommendedPct = Number(signal.recommendedStakePct || 0);
  const bank = Number(account?.stats?.bankUsdc ?? account?.user?.bankUsdc ?? 0);

  const notes = [];
  let action = 'skip';
  let side = signal.suggestedSide || signal.side;
  let pct = 0;

  if (signal.suggestedAction === 'skip') notes.push('Soliris signal suggested skip.');
  if (context?.oddsSummary) notes.push(`ESPN odds/context: ${context.oddsSummary}.`);
  if (context?.error) notes.push(`External context fetch issue: ${context.error}.`);

  if (strength === 'STRONG' && confidence >= 62 && signal.suggestedAction !== 'skip') {
    action = 'follow';
    pct = Math.min(recommendedPct || 0.05, 0.05);
    notes.push('Strong signal with adequate confidence; default follow unless external context contradicts.');
  } else if (strength === 'MODERATE' && confidence >= 58 && signal.suggestedAction !== 'skip') {
    action = 'follow';
    pct = Math.min(recommendedPct || 0.02, 0.02);
    notes.push('Moderate signal with acceptable confidence; small controlled stake.');
  } else {
    notes.push('Confidence/strength is not enough for a forced entry.');
  }

  // Conservative guardrail: no soccer entries without stronger confidence until there is history.
  if (signal.sport === 'soccer' && confidence < 55) {
    action = 'skip';
    pct = 0;
    notes.push('Soccer confidence below current strategy threshold.');
  }

  const stakeUsdc = Math.max(0, Math.round(bank * pct * 100) / 100);
  if (stakeUsdc < 1) action = 'skip';

  return { action, side, stakeUsdc, notes };
}

function row(items) {
  return `| ${items.map((item) => String(item ?? '').replace(/\|/g, '\\|')).join(' | ')} |`;
}

async function main() {
  await mcp('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'soliris-github-daily-picker', version: '0.1.0' },
  });

  const before = await tool('prop_me', { userId: USER_ID, displayName: DISPLAY_NAME });
  const positionsBefore = await tool('prop_my_positions', { userId: USER_ID, status: 'all', limit: 200 });
  const leaderboard = await tool('prop_leaderboard', { limit: 20 });
  const signals = await tool('prop_signals', {});
  const openRefs = positionSignalRefs(positionsBefore.positions);

  const decisions = [];
  const placed = [];

  for (const signal of signals.signals || []) {
    if (openRefs.has(signal.signalRef)) {
      decisions.push({ signal, decision: { action: 'skip', side: null, stakeUsdc: 0, notes: ['Already have an open position for this signal.'] }, context: null });
      continue;
    }

    const context = await espnSummary(signal.sport, signal.gameId);
    const decision = choose(signal, context, before);
    decisions.push({ signal, decision, context });

    if (decision.action !== 'skip' && !DRY_RUN) {
      const args = { userId: USER_ID, signalRef: signal.signalRef, stakeUsdc: decision.stakeUsdc };
      if (decision.side) args.side = decision.side;
      const result = await tool('prop_open_position', args);
      placed.push({ signal, decision, result });
    }
  }

  const positionsAfter = await tool('prop_my_positions', { userId: USER_ID, status: 'all', limit: 200 });
  const after = await tool('prop_me', { userId: USER_ID, displayName: DISPLAY_NAME });

  const top = leaderboard.leaderboard?.[0];
  const me = leaderboard.leaderboard?.find((entry) => entry.id === USER_ID);

  const lines = [];
  lines.push('# Soliris Prop Edge Daily Run');
  lines.push('');
  lines.push(`Mode: ${DRY_RUN ? 'dry run' : 'live paper picks'}`);
  lines.push(`Signals found: ${signals.count ?? signals.signals?.length ?? 0}`);
  lines.push(`Picks placed: ${placed.length}`);
  lines.push('');
  lines.push('## Account');
  lines.push('');
  lines.push(`Before bank: $${before.stats.bankUsdc}`);
  lines.push(`After bank: $${after.stats.bankUsdc}`);
  lines.push(`Open positions: ${after.stats.openCount}`);
  lines.push(`Settled: ${after.stats.settledCount}`);
  lines.push(`ROI: ${after.stats.roiPct}%`);
  lines.push('');
  lines.push('## Leaderboard Context');
  lines.push('');
  lines.push(`Top rank: ${top?.displayName || top?.idShort || top?.id || 'unknown'} with bank $${top?.bankUsdc ?? 'n/a'}`);
  lines.push(`Our rank in top 20: ${me?.rank ?? 'not in top 20 yet'}`);
  lines.push('');
  lines.push('## Decisions');
  lines.push('');
  lines.push(row(['Signal', 'Game', 'Strength', 'Confidence', 'Decision', 'Stake', 'Reason']));
  lines.push(row(['---', '---', '---', '---', '---', '---', '---']));
  for (const { signal, decision } of decisions) {
    lines.push(row([
      signal.signalRef,
      `${signal.awayTeam} @ ${signal.homeTeam}`,
      signal.edgeStrength,
      signal.confidence,
      decision.action === 'skip' ? 'skip' : `${decision.action} ${decision.side}`,
      decision.stakeUsdc ? `$${decision.stakeUsdc}` : '-',
      decision.notes.join(' '),
    ]));
  }
  lines.push('');
  lines.push('## Open Positions');
  lines.push('');
  lines.push(row(['ID', 'Signal', 'Side', 'Stake', 'Status', 'Game time']));
  lines.push(row(['---', '---', '---', '---', '---', '---']));
  for (const p of positionsAfter.positions || []) {
    if (p.status === 'open') lines.push(row([p.id, p.signalRef, p.userSide, `$${p.stakeUsdc}`, p.status, p.gameTime]));
  }

  const summary = lines.join('\n');
  console.log(summary);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const fs = await import('node:fs/promises');
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
