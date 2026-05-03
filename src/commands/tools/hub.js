const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { getDb } = require('../../services/database');
const { getStreak } = require('../../services/streakService');
const { COLORS, embed, progressBar, todayEpoch, weekStartFor, titleCase } = require('../../utils/helpers');
const { registerButton } = require('../../services/buttonHandler');
const { cacheEmbed } = require('../../services/buttonHandler');

// ─── Register hub button handlers ───

registerButton('hub_back', async (interaction) => {
  await interaction.deferUpdate();
  const { embeds, components } = buildHubHome(interaction.user.id, interaction.guildId, interaction.user);
  await interaction.editReply({ embeds, components });
});

registerButton('hub_privacy', async (interaction) => {
  const db = getDb();
  const profile = db.prepare(
    'SELECT is_public FROM user_profiles WHERE user_id = ? AND guild_id = ?'
  ).get(interaction.user.id, interaction.guildId);
  const current = profile?.is_public ?? 1;
  const newVal = current ? 0 : 1;
  db.prepare(`
    INSERT INTO user_profiles (user_id, guild_id, is_public) VALUES (?, ?, ?)
    ON CONFLICT(user_id, guild_id) DO UPDATE SET is_public = excluded.is_public
  `).run(interaction.user.id, interaction.guildId, newVal);
  const label = newVal ? 'Public' : 'Private';
  await interaction.reply({ content: `Your profile is now **${label}** ${newVal ? '🌐' : '🔒'}`, ephemeral: true });
});

registerButton('hub_viewstats', async (interaction) => {
  await interaction.deferUpdate();
  const embeds = buildQuickStats(interaction.user.id, interaction.guildId, interaction.user);
  const key = `stats|${interaction.user.id}|${Date.now()}`;
  cacheEmbed(key, embeds, interaction.guildId);
  const components = [
    backRow(),
    publishRow(key),
  ];
  await interaction.editReply({ embeds, components });
});

registerButton('hub_viewgoals', async (interaction) => {
  await interaction.deferUpdate();
  const { embeds, components } = buildGoalsView(interaction.user.id, interaction.guildId, interaction.user);
  await interaction.editReply({ embeds, components });
});

registerButton('hub_history', async (interaction) => {
  await interaction.deferUpdate();
  const { embeds, components } = buildHistoryView(interaction.user.id, interaction.guildId, interaction.user, weekStartFor());
  await interaction.editReply({ embeds, components });
});

registerButton('hist_prev', async (interaction) => {
  const ws = interaction.customId.split('|')[1];
  const d = new Date(ws + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 7);
  const newWs = d.toISOString().slice(0, 10);
  await interaction.deferUpdate();
  const { embeds, components } = buildHistoryView(interaction.user.id, interaction.guildId, interaction.user, newWs);
  await interaction.editReply({ embeds, components });
});

registerButton('hist_next', async (interaction) => {
  const ws = interaction.customId.split('|')[1];
  const d = new Date(ws + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 7);
  const newWs = d.toISOString().slice(0, 10);
  const currentWs = weekStartFor();
  if (newWs > currentWs) {
    return interaction.reply({ content: "Can't view future weeks.", ephemeral: true });
  }
  await interaction.deferUpdate();
  const { embeds, components } = buildHistoryView(interaction.user.id, interaction.guildId, interaction.user, newWs);
  await interaction.editReply({ embeds, components });
});

registerButton('hub_workouts', async (interaction) => {
  await interaction.deferUpdate();
  const { embeds, components } = buildWorkoutLogView(interaction.user.id, interaction.guildId, interaction.user, 0);
  await interaction.editReply({ embeds, components });
});

registerButton('wlog_prev', async (interaction) => {
  const page = parseInt(interaction.customId.split('|')[1]) || 0;
  await interaction.deferUpdate();
  const { embeds, components } = buildWorkoutLogView(interaction.user.id, interaction.guildId, interaction.user, Math.max(0, page - 1));
  await interaction.editReply({ embeds, components });
});

registerButton('wlog_next', async (interaction) => {
  const page = parseInt(interaction.customId.split('|')[1]) || 0;
  await interaction.deferUpdate();
  const { embeds, components } = buildWorkoutLogView(interaction.user.id, interaction.guildId, interaction.user, page + 1);
  await interaction.editReply({ embeds, components });
});

registerButton('wlog_del', async (interaction) => {
  const workoutId = interaction.customId.split('|')[1];
  const db = getDb();
  db.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ? AND guild_id = ?')
    .run(workoutId, interaction.user.id, interaction.guildId);
  await interaction.deferUpdate();
  const { embeds, components } = buildWorkoutLogView(interaction.user.id, interaction.guildId, interaction.user, 0);
  await interaction.editReply({ embeds, components });
});

registerButton('goal_del', async (interaction) => {
  const goalId = interaction.customId.split('|')[1];
  const db = getDb();
  db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ? AND guild_id = ?')
    .run(goalId, interaction.user.id, interaction.guildId);
  await interaction.deferUpdate();
  const { embeds, components } = buildGoalsView(interaction.user.id, interaction.guildId, interaction.user);
  await interaction.editReply({ embeds, components });
});

registerButton('goal_complete', async (interaction) => {
  const goalId = interaction.customId.split('|')[1];
  const db = getDb();
  db.prepare('UPDATE goals SET completed = 1, current_value = target_value WHERE id = ? AND user_id = ? AND guild_id = ?')
    .run(goalId, interaction.user.id, interaction.guildId);
  await interaction.deferUpdate();
  const { embeds, components } = buildGoalsView(interaction.user.id, interaction.guildId, interaction.user);
  await interaction.editReply({ embeds, components });
});

// ─── Hub select menu handler ───

registerButton('hub_select', async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  const value = interaction.values[0];

  switch (value) {
    case 'privacy': {
      const db = getDb();
      const profile = db.prepare('SELECT is_public FROM user_profiles WHERE user_id = ? AND guild_id = ?')
        .get(interaction.user.id, interaction.guildId);
      const current = profile?.is_public ?? 1;
      const label = current ? 'Public 🌐' : 'Private 🔒';
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('hub_privacy').setLabel(`Toggle (currently ${label})`).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hub_back').setLabel('Back to Hub').setStyle(ButtonStyle.Primary),
      );
      await interaction.update({
        embeds: [embed('🔒 Privacy Settings', `Your profile is currently **${label}**.\nWhen private, others cannot view your stats, goals, or history.`, COLORS.primary)],
        components: [row],
      });
      break;
    }
    case 'stats':
      await interaction.deferUpdate();
      const statsEmbeds = buildQuickStats(interaction.user.id, interaction.guildId, interaction.user);
      const statsKey = `stats|${interaction.user.id}|${Date.now()}`;
      cacheEmbed(statsKey, statsEmbeds, interaction.guildId);
      await interaction.editReply({ embeds: statsEmbeds, components: [backRow(), publishRow(statsKey)] });
      break;
    case 'goals':
      await interaction.deferUpdate();
      const gv = buildGoalsView(interaction.user.id, interaction.guildId, interaction.user);
      await interaction.editReply({ embeds: gv.embeds, components: gv.components });
      break;
    case 'history':
      await interaction.deferUpdate();
      const hv = buildHistoryView(interaction.user.id, interaction.guildId, interaction.user, weekStartFor());
      await interaction.editReply({ embeds: hv.embeds, components: hv.components });
      break;
    case 'workouts':
      await interaction.deferUpdate();
      const wv = buildWorkoutLogView(interaction.user.id, interaction.guildId, interaction.user, 0);
      await interaction.editReply({ embeds: wv.embeds, components: wv.components });
      break;
    case 'profile':
      await interaction.reply({
        content: 'Use `/profile setup` to configure your profile, or `/profile view` to see it.',
        ephemeral: true,
      });
      break;
    default:
      await interaction.deferUpdate();
  }
});

// ─── Builder functions ───

function backRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('hub_back').setLabel('Back to Hub').setStyle(ButtonStyle.Secondary).setEmoji('◀️'),
  );
}

function publishRow(key) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`publish|${key}`).setLabel('Publish to Channel').setStyle(ButtonStyle.Secondary).setEmoji('📢'),
  );
}

function buildHubHome(userId, guildId, user) {
  const db = getDb();
  const streak = db.prepare('SELECT current_streak FROM streaks WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  const workoutCount = db.prepare('SELECT COUNT(*) as c FROM workouts WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  const profile = db.prepare('SELECT is_public FROM user_profiles WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  const privLabel = (profile?.is_public ?? 1) ? 'Public 🌐' : 'Private 🔒';

  const e = new EmbedBuilder()
    .setTitle(`🐻 Fitness Hub - ${user.displayName}`)
    .setDescription(
      'Select a feature below to get started.\n' +
      'All responses are **private** unless you publish them.'
    )
    .addFields(
      { name: 'Workouts', value: `${workoutCount?.c || 0} total`, inline: true },
      { name: 'Streak', value: `${streak?.current_streak || 0} day(s) ${(streak?.current_streak || 0) >= 7 ? '🔥' : ''}`, inline: true },
      { name: 'Privacy', value: privLabel, inline: true },
    )
    .setColor(COLORS.fire)
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();

  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('hub_select')
      .setPlaceholder('Select a feature...')
      .addOptions([
        { label: '🔒 Privacy Settings', description: `Currently: ${privLabel}`, value: 'privacy' },
        { label: '📊 Current Stats', description: 'View your latest stats and body measurements', value: 'stats' },
        { label: '🎯 Fitness Goals', description: 'View, add, or manage your goals', value: 'goals' },
        { label: '📅 Weekly History', description: 'Browse week-by-week progress', value: 'history' },
        { label: '🏋️ Workout Log', description: 'Browse and manage past workouts', value: 'workouts' },
        { label: '👤 Profile Setup', description: 'Configure your fitness profile', value: 'profile' },
      ])
  );

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('hub_viewstats').setLabel('Quick Stats').setStyle(ButtonStyle.Primary).setEmoji('📊'),
    new ButtonBuilder().setCustomId('hub_viewgoals').setLabel('Goals').setStyle(ButtonStyle.Success).setEmoji('🎯'),
    new ButtonBuilder().setCustomId('hub_workouts').setLabel('Workouts').setStyle(ButtonStyle.Secondary).setEmoji('🏋️'),
    new ButtonBuilder().setCustomId('hub_history').setLabel('History').setStyle(ButtonStyle.Secondary).setEmoji('📅'),
  );

  return { embeds: [e], components: [selectRow, buttonRow] };
}

function buildQuickStats(userId, guildId, user) {
  const db = getDb();
  const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  const weekAgo = Math.floor(Date.now() / 1000) - 604800;
  const weekWorkouts = db.prepare('SELECT COUNT(*) as c FROM workouts WHERE user_id = ? AND guild_id = ? AND created_at >= ?').get(userId, guildId, weekAgo);
  const latestWeight = db.prepare("SELECT value, unit FROM body_stats WHERE user_id = ? AND guild_id = ? AND type = 'weight' ORDER BY created_at DESC LIMIT 1").get(userId, guildId);
  const todayWater = db.prepare('SELECT COALESCE(SUM(amount_ml),0) as t FROM water_logs WHERE user_id = ? AND guild_id = ? AND created_at >= ?').get(userId, guildId, todayEpoch());
  const prCount = db.prepare('SELECT COUNT(*) as c FROM personal_records WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  const latestSleep = db.prepare('SELECT hours, quality FROM sleep_logs WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT 1').get(userId, guildId);

  const e = new EmbedBuilder()
    .setTitle(`📊 Quick Stats - ${user.displayName}`)
    .setColor(COLORS.primary)
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: 'Streak', value: `${streak?.current_streak || 0} day(s) ${(streak?.current_streak || 0) >= 7 ? '🔥' : ''}`, inline: true },
      { name: 'This Week', value: `${weekWorkouts?.c || 0} workouts`, inline: true },
      { name: 'PRs', value: `${prCount?.c || 0} recorded`, inline: true },
    )
    .setTimestamp();

  if (latestWeight) {
    e.addFields({ name: 'Weight', value: `${latestWeight.value} ${latestWeight.unit}`, inline: true });
  }
  e.addFields({ name: 'Water Today', value: `${todayWater?.t || 0}ml`, inline: true });
  if (latestSleep) {
    e.addFields({ name: 'Last Sleep', value: `${latestSleep.hours}h${latestSleep.quality ? ` (${'⭐'.repeat(latestSleep.quality)})` : ''}`, inline: true });
  }

  return [e];
}

function buildGoalsView(userId, guildId, user) {
  const db = getDb();
  const goals = db.prepare('SELECT * FROM goals WHERE user_id = ? AND guild_id = ? ORDER BY completed ASC, created_at DESC').all(userId, guildId);

  const e = new EmbedBuilder()
    .setTitle(`🎯 Goals - ${user.displayName}`)
    .setColor(COLORS.gold)
    .setTimestamp();

  if (goals.length === 0) {
    e.setDescription('No goals set yet. Use `/goal set` to create one!');
    return { embeds: [e], components: [backRow()] };
  }

  const components = [backRow()];

  for (const g of goals.slice(0, 10)) {
    const pct = g.target_value > 0 ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0;
    const status = g.completed ? '✅' : '🔄';
    const dir = g.direction === 'decrease' ? '📉' : '📈';
    let value = `${status} ${dir} ${g.current_value} / ${g.target_value} ${g.unit || ''}\n${progressBar(g.current_value, g.target_value || 1)} ${pct}%`;
    if (g.deadline) value += `\nDeadline: <t:${g.deadline}:R>`;
    if (g.milestone_pct) {
      const announced = JSON.parse(g.milestones_announced || '[]');
      if (announced.length > 0) value += `\nMilestones hit: ${announced.map(p => `${p}%`).join(', ')}`;
    }
    e.addFields({ name: `#${g.id} - ${g.title}`, value });
  }

  // Add delete/complete buttons for active goals (up to 5)
  const activeGoals = goals.filter(g => !g.completed).slice(0, 4);
  if (activeGoals.length > 0) {
    const goalActions = new ActionRowBuilder();
    for (const g of activeGoals.slice(0, 2)) {
      goalActions.addComponents(
        new ButtonBuilder()
          .setCustomId(`goal_complete|${g.id}`)
          .setLabel(`Complete #${g.id}`)
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
      );
    }
    for (const g of activeGoals.slice(0, 2)) {
      goalActions.addComponents(
        new ButtonBuilder()
          .setCustomId(`goal_del|${g.id}`)
          .setLabel(`Delete #${g.id}`)
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️'),
      );
    }
    components.push(goalActions);
  }

  const key = `goals|${userId}|${Date.now()}`;
  cacheEmbed(key, [e], guildId);
  components.push(publishRow(key));

  return { embeds: [e], components };
}

function buildHistoryView(userId, guildId, user, ws) {
  const db = getDb();
  const wsDate = new Date(ws + 'T00:00:00Z');
  const weDate = new Date(wsDate);
  weDate.setUTCDate(weDate.getUTCDate() + 6);
  const we = weDate.toISOString().slice(0, 10);
  const wsEpoch = Math.floor(wsDate.getTime() / 1000);
  const weEpoch = Math.floor(weDate.getTime() / 1000) + 86399;

  const label = `${wsDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const e = new EmbedBuilder()
    .setTitle(`📅 ${user.displayName} - Week of ${label}`)
    .setColor(COLORS.primary)
    .setTimestamp();

  // Workouts this week
  const workouts = db.prepare(
    'SELECT exercise, category, sets, reps, weight, weight_unit, created_at FROM workouts WHERE user_id = ? AND guild_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at'
  ).all(userId, guildId, wsEpoch, weEpoch);

  if (workouts.length > 0) {
    const lines = workouts.slice(0, 10).map(w => {
      const date = new Date(w.created_at * 1000).toLocaleDateString('en-US', { weekday: 'short' });
      const name = titleCase(w.exercise);
      let detail = `${w.sets}x${w.reps}`;
      if (w.weight > 0) detail += ` @ ${w.weight}${w.weight_unit}`;
      return `**${date}** [${w.category || '?'}] ${name} - ${detail}`;
    }).join('\n');
    e.addFields({ name: '🏋️ Workouts', value: lines });
  } else {
    e.addFields({ name: '🏋️ Workouts', value: 'None logged this week' });
  }

  // Body stats this week
  const bodyStats = db.prepare(
    'SELECT type, value, unit, created_at FROM body_stats WHERE user_id = ? AND guild_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at'
  ).all(userId, guildId, wsEpoch, weEpoch);

  if (bodyStats.length > 0) {
    const lines = bodyStats.map(s => {
      const date = new Date(s.created_at * 1000).toLocaleDateString('en-US', { weekday: 'short' });
      return `**${date}** ${s.type}: ${s.value} ${s.unit}`;
    }).join('\n');
    e.addFields({ name: '📊 Stat Updates', value: lines });
  }

  // Weekly note
  const note = db.prepare(
    'SELECT note FROM history_notes WHERE user_id = ? AND guild_id = ? AND week_start = ?'
  ).get(userId, guildId, ws);

  e.addFields({ name: '📝 Note', value: note?.note || 'No note for this week.' });

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`hist_prev|${ws}`).setLabel('◀ Prev Week').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`hist_next|${ws}`).setLabel('Next Week ▶').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('hub_back').setLabel('Back to Hub').setStyle(ButtonStyle.Primary).setEmoji('◀️'),
  );

  const key = `history|${userId}|${ws}`;
  cacheEmbed(key, [e], guildId);

  return { embeds: [e], components: [navRow, publishRow(key)] };
}

function buildWorkoutLogView(userId, guildId, user, page) {
  const db = getDb();
  const PAGE_SIZE = 5;
  const total = db.prepare('SELECT COUNT(*) as c FROM workouts WHERE user_id = ? AND guild_id = ?').get(userId, guildId).c;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  page = Math.max(0, Math.min(page, maxPage));

  const workouts = db.prepare(
    'SELECT * FROM workouts WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(userId, guildId, PAGE_SIZE, page * PAGE_SIZE);

  const e = new EmbedBuilder()
    .setTitle(`🏋️ ${user.displayName} - Workout Log`)
    .setDescription(`Page ${page + 1} of ${maxPage + 1} · ${total} total entries`)
    .setColor(COLORS.primary)
    .setTimestamp();

  for (const w of workouts) {
    const name = titleCase(w.exercise);
    const date = new Date(w.created_at * 1000).toLocaleDateString();
    let value = `${w.sets}x${w.reps}`;
    if (w.weight > 0) value += ` @ ${w.weight} ${w.weight_unit}`;
    if (w.details) value += `\n${w.details}`;
    if (w.notes) value += `\n*${w.notes}*`;
    e.addFields({ name: `[${w.category || '?'}] ${name} - ${date}`, value });
  }

  if (workouts.length === 0) {
    e.setDescription('No workouts logged yet. Use `/log` to start!');
  }

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`wlog_prev|${page}`)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`wlog_next|${page}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= maxPage),
    new ButtonBuilder()
      .setCustomId('hub_back')
      .setLabel('Back to Hub')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('◀️'),
  );

  const components = [navRow];

  // Delete buttons for visible workouts (up to 4)
  if (workouts.length > 0) {
    const delRow = new ActionRowBuilder();
    for (const w of workouts.slice(0, 4)) {
      const label = titleCase(w.exercise).slice(0, 15);
      delRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`wlog_del|${w.id}`)
          .setLabel(`🗑️ ${label}`)
          .setStyle(ButtonStyle.Danger),
      );
    }
    components.push(delRow);
  }

  const key = `wlog|${userId}|${page}`;
  cacheEmbed(key, [e], guildId);
  components.push(publishRow(key));

  return { embeds: [e], components };
}

// ─── Exported command ───

async function openFitnessHub(interaction) {
  const { embeds, components } = buildHubHome(interaction.user.id, interaction.guildId, interaction.user);
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ embeds, components });
  } else {
    await interaction.reply({ embeds, components, ephemeral: true });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fitness')
    .setDescription('Open the fitness hub - access all features from one place'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    await openFitnessHub(interaction);
  },

  openFitnessHub,
};
