const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const COLORS = {
  primary: 0x5865F2,
  success: 0x57F287,
  warning: 0xFEE75C,
  error: 0xED4245,
  fire: 0xFF6B35,
  water: 0x3498DB,
  gold: 0xF1C40F,
  muscle: 0xE74C3C,
};

function embed(title, description, color = COLORS.primary) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
}

function errorEmbed(message) {
  return embed('Error', message, COLORS.error);
}

function successEmbed(title, message) {
  return embed(title, message, COLORS.success);
}

function progressBar(current, max, length = 10) {
  const filled = Math.round((current / max) * length);
  const empty = length - filled;
  return '`' + '\u2588'.repeat(filled) + '\u2591'.repeat(empty) + '`';
}

function formatNumber(n) {
  return n.toLocaleString('en-US');
}

function daysBetween(ts1, ts2) {
  return Math.floor(Math.abs(ts2 - ts1) / 86400);
}

function todayEpoch() {
  // Use UTC to stay consistent with SQLite's strftime('%s','now')
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
}

function weekStartFor(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function publishButton(customIdSuffix) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`publish|${customIdSuffix}`)
      .setLabel('Publish to Channel')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📢')
  );
}

async function safeDM(user, content) {
  try {
    const dm = await user.createDM();
    await dm.send(content);
    return true;
  } catch {
    return false;
  }
}

function parseDuration(str) {
  const match = str.match(/^(\d+)\s*(s|sec|m|min|h|hr|d|day)s?$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1, sec: 1, m: 60, min: 60, h: 3600, hr: 3600, d: 86400, day: 86400 };
  return val * (multipliers[unit] || 0);
}

// Capitalize each whitespace-separated word. Tolerates empty tokens (multiple spaces)
// and non-string input so callers don't have to guard.
function titleCase(str) {
  if (typeof str !== 'string' || !str) return '';
  return str.split(/\s+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

module.exports = {
  COLORS, embed, errorEmbed, successEmbed, progressBar,
  formatNumber, daysBetween, todayEpoch, weekStartFor,
  safeDM, parseDuration, publishButton, titleCase,
};
