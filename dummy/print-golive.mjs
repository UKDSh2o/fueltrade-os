// Prints the provider swap table (Markdown) from lib/providers.js. Used to build docs/GO-LIVE.md.
import { PROVIDERS } from '../lib/providers.js';
const rows = PROVIDERS.map(p => `| **${p.label}** (${p.feature}) | ${[...p.required.map(v => `\`${v}\``), ...p.optional.map(v => `\`${v}\` (optional)`)].join('<br>') || 'none'} | ${p.live} |`);
console.log(['| Integration | Variables to set | What to put there |', '| --- | --- | --- |', ...rows].join('\n'));
