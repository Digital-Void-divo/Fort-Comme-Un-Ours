const { EmbedBuilder } = require('discord.js');

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
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
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

module.exports = {
  COLORS, embed, errorEmbed, successEmbed, progressBar,
  formatNumber, daysBetween, todayEpoch, safeDM, parseDuration,
};
