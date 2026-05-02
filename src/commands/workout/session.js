const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { getDb } = require('../../services/database');
const sessions = require('../../services/sessionService');
const buddies = require('../../services/buddyService');
const privacy = require('../../services/privacyService');
const audit = require('../../services/auditService');
const { estimateCalories, lbsToKg } = require('../../services/calorieService');
const { COLORS, embed, successEmbed, safeDM, publishButton } = require('../../utils/helpers');
const { cacheEmbed, registerButton } = require('../../services/buttonHandler');

const SESSION_TYPES = [
  { name: 'Strength', value: 'strength' },
  { name: 'Cardio', value: 'cardio' },
  { name: 'HIIT', value: 'hiit' },
  { name: 'Yoga / Mobility', value: 'yoga' },
  { name: 'Sport', value: 'sport' },
  { name: 'Recovery', value: 'recovery' },
  { name: 'Walk', value: 'walk' },
  { name: 'Run', value: 'run' },
  { name: 'Bike', value: 'bike' },
  { name: 'Swim', value: 'swim' },
  { name: 'Other', value: 'other' },
];

function fmtDuration(sec) {
  if (!sec || sec < 0) return '0m';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function endSessionRow(sessionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`session_end|${sessionId}`).setLabel('End Session').setStyle(ButtonStyle.Success).setEmoji('🏁'),
    new ButtonBuilder().setCustomId(`session_cancel|${sessionId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
  );
}

// Handle "End Session" button → open modal
registerButton('session_end', async (interaction) => {
  const sessionId = parseInt(interaction.customId.split('|')[1], 10);
  const session = sessions.getSession(sessionId);
  if (!session || session.ended_at || session.cancelled) {
    return interaction.reply({ content: 'This session is no longer active.', ephemeral: true });
  }
  if (session.user_id !== interaction.user.id) {
    return interaction.reply({ content: 'Only the session owner can end this.', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(`session_end_modal|${sessionId}`)
    .setTitle('End Session');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('activities').setLabel('Activities (comma-separated)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(200).setPlaceholder('e.g. squats, rows, plank')),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('intensity').setLabel('Intensity 1–10 (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(2).setPlaceholder('7')),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('mood').setLabel('Mood (😩 😐 🙂 💪 🔥 or word)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(20).setPlaceholder('💪')),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('hr').setLabel('Heart rate avg/max (e.g. 142/178)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(15).setPlaceholder('optional')),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('notes').setLabel('Notes (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)),
  );

  await interaction.showModal(modal);
});

registerButton('session_cancel', async (interaction) => {
  const sessionId = parseInt(interaction.customId.split('|')[1], 10);
  const session = sessions.getSession(sessionId);
  if (!session || session.user_id !== interaction.user.id) {
    return interaction.reply({ content: 'Only the session owner can cancel this.', ephemeral: true });
  }
  const ok = sessions.cancelSession(sessionId);
  audit.log(interaction.guildId, interaction.user.id, 'session.cancel', { sessionId });
  if (ok) {
    await interaction.update({
      embeds: [embed('Session Cancelled', 'Your session was cancelled and not recorded.', COLORS.warning)],
      components: [],
    });
  } else {
    await interaction.reply({ content: 'Could not cancel — session may already be ended.', ephemeral: true });
  }
});

// Modal submit handler (registered under 'session_end_modal')
registerButton('session_end_modal', async (interaction) => {
  if (!interaction.isModalSubmit?.()) return;
  const sessionId = parseInt(interaction.customId.split('|')[1], 10);
  const session = sessions.getSession(sessionId);
  if (!session || session.user_id !== interaction.user.id) {
    return interaction.reply({ content: 'Session not found or not yours.', ephemeral: true });
  }

  const activities = interaction.fields.getTextInputValue('activities')?.trim() || null;
  const intensityRaw = interaction.fields.getTextInputValue('intensity')?.trim();
  const mood = interaction.fields.getTextInputValue('mood')?.trim() || null;
  const hrRaw = interaction.fields.getTextInputValue('hr')?.trim();
  const notes = interaction.fields.getTextInputValue('notes')?.trim() || null;

  let intensity = null;
  if (intensityRaw) {
    const n = parseInt(intensityRaw, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 10) intensity = n;
  }
  let hrAvg = null, hrMax = null;
  if (hrRaw) {
    const m = hrRaw.match(/(\d{2,3})\s*[/,\s]\s*(\d{2,3})/);
    if (m) { hrAvg = parseInt(m[1], 10); hrMax = parseInt(m[2], 10); }
    else {
      const n = parseInt(hrRaw, 10);
      if (!Number.isNaN(n)) hrAvg = n;
    }
  }

  // Calorie estimate based on body weight from profile
  const profile = getDb().prepare('SELECT weight_kg, weight_unit FROM user_profiles WHERE user_id = ? AND guild_id = ?')
    .get(session.user_id, session.guild_id);
  let weightKg = profile?.weight_kg || null;
  if (!weightKg) {
    const bw = getDb().prepare(
      "SELECT value, unit FROM body_stats WHERE user_id = ? AND guild_id = ? AND type = 'weight' ORDER BY created_at DESC LIMIT 1"
    ).get(session.user_id, session.guild_id);
    if (bw) weightKg = bw.unit === 'kg' ? bw.value : lbsToKg(bw.value);
  }
  const durationSec = Math.floor(Date.now() / 1000) - session.started_at;
  const cal = estimateCalories({ sessionType: session.session_type, durationSec, intensity, weightKg });

  const result = sessions.endSession(sessionId, {
    activities, intensity, mood,
    heart_rate_avg: hrAvg, heart_rate_max: hrMax, calories_est: cal, notes,
  });
  if (!result.ok) {
    return interaction.reply({ content: 'Failed to end session.', ephemeral: true });
  }
  audit.log(interaction.guildId, interaction.user.id, 'session.end', { sessionId, durationSec: result.durationSec, calEst: cal });

  const e = new EmbedBuilder()
    .setTitle('🏁 Session Ended')
    .setColor(COLORS.success)
    .setTimestamp()
    .addFields(
      { name: 'Duration', value: fmtDuration(result.durationSec), inline: true },
      { name: 'Type', value: session.session_type || '—', inline: true },
      { name: 'Calories (est.)', value: `${cal} kcal`, inline: true },
    );
  if (intensity) e.addFields({ name: 'Intensity', value: `${intensity}/10`, inline: true });
  if (mood) e.addFields({ name: 'Mood', value: mood, inline: true });
  if (hrAvg) e.addFields({ name: 'HR (avg/max)', value: `${hrAvg}${hrMax ? '/' + hrMax : ''} bpm`, inline: true });
  if (activities) e.addFields({ name: 'Activities', value: activities });
  if (notes) e.addFields({ name: 'Notes', value: notes });

  // Auto-link any workouts logged after session start
  getDb().prepare(
    `UPDATE workouts SET session_id = ?
       WHERE user_id = ? AND guild_id = ? AND session_id IS NULL
         AND created_at >= ? AND created_at <= strftime('%s','now')`
  ).run(sessionId, session.user_id, session.guild_id, session.started_at);

  const cacheKey = `session|${session.user_id}|${Date.now()}`;
  cacheEmbed(cacheKey, [e], session.guild_id);
  await interaction.reply({ embeds: [e], components: [publishButton(cacheKey)], ephemeral: true });

  // Notify buddies (respects sender's notify_buddy_on_session)
  try {
    const senderSettings = privacy.getSettings(session.user_id, session.guild_id);
    if (senderSettings.notifyBuddyOnSession) {
      const buddyIds = buddies.getActiveBuddyIds(session.user_id, session.guild_id);
      const guild = interaction.guild;
      for (const bid of buddyIds) {
        try {
          const member = await guild.members.fetch(bid);
          await safeDM(member.user, {
            embeds: [successEmbed('Buddy Wrapped a Session',
              `**${interaction.user.displayName}** just finished a ${fmtDuration(result.durationSec)} ${session.session_type || ''} session.${activities ? `\nActivities: ${activities}` : ''}`)],
          });
        } catch { /* ignore */ }
      }
    }
  } catch (err) {
    console.error('Buddy session notify failed:', err.message);
  }
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('session')
    .setDescription('Check in / out of a gym or workout session')
    .addSubcommand(sub =>
      sub.setName('start').setDescription('Check into a workout session')
        .addStringOption(opt => opt.setName('type').setDescription('Session type').addChoices(...SESSION_TYPES))
        .addStringOption(opt => opt.setName('location').setDescription('Where? (gym name, home, park...)').setMaxLength(60))
        .addStringOption(opt => opt.setName('plan').setDescription('What do you plan to do?').setMaxLength(200))
        .addBooleanOption(opt => opt.setName('public').setDescription('Visible to others (default: your privacy setting)')))
    .addSubcommand(sub =>
      sub.setName('end').setDescription('Check out of your active session'))
    .addSubcommand(sub =>
      sub.setName('cancel').setDescription('Abandon your active session without recording'))
    .addSubcommand(sub =>
      sub.setName('status').setDescription('Show your or another user\'s active session')
        .addUserOption(opt => opt.setName('user').setDescription('User to check')))
    .addSubcommand(sub =>
      sub.setName('history').setDescription('Show your recent sessions')
        .addIntegerOption(opt => opt.setName('limit').setDescription('How many (max 25)').setMinValue(1).setMaxValue(25))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const type = interaction.options.getString('type') || null;
      const location = interaction.options.getString('location') || null;
      const plan = interaction.options.getString('plan') || null;
      const explicitPublic = interaction.options.getBoolean('public');

      const settings = privacy.getSettings(interaction.user.id, interaction.guildId);
      const isPublic = explicitPublic === null
        ? (settings.visibility === 'public' ? 1 : 0)
        : (explicitPublic ? 1 : 0);

      const result = sessions.startSession({
        userId: interaction.user.id, guildId: interaction.guildId,
        sessionType: type, location, plannedActivities: plan, isPublic,
      });
      if (!result.ok && result.reason === 'already_active') {
        const elapsed = Math.floor(Date.now() / 1000) - result.session.started_at;
        return interaction.reply({
          embeds: [embed('Already Checked In',
            `You started a session ${fmtDuration(elapsed)} ago. End or cancel it first.`,
            COLORS.warning)],
          components: [endSessionRow(result.session.id)],
          ephemeral: true,
        });
      }
      audit.log(interaction.guildId, interaction.user.id, 'session.start', { sessionId: result.sessionId, type, location });

      const e = new EmbedBuilder()
        .setTitle('🟢 Checked In')
        .setColor(COLORS.success)
        .setDescription(`Started <t:${result.startedAt}:R>`)
        .setTimestamp();
      if (type) e.addFields({ name: 'Type', value: type, inline: true });
      if (location) e.addFields({ name: 'Location', value: location, inline: true });
      if (plan) e.addFields({ name: 'Plan', value: plan });
      e.setFooter({ text: 'Workouts you log will auto-link to this session.' });

      await interaction.reply({
        embeds: [e],
        components: [endSessionRow(result.sessionId)],
        ephemeral: !isPublic,
      });

      // Notify buddies a session started
      try {
        if (settings.notifyBuddyOnSession) {
          const buddyIds = buddies.getActiveBuddyIds(interaction.user.id, interaction.guildId);
          for (const bid of buddyIds) {
            try {
              const member = await interaction.guild.members.fetch(bid);
              await safeDM(member.user, {
                embeds: [embed('Buddy Started a Session',
                  `**${interaction.user.displayName}** just checked in${type ? ` for ${type}` : ''}${location ? ` at ${location}` : ''}.`,
                  COLORS.primary)],
              });
            } catch { /* ignore */ }
          }
        }
      } catch (err) {
        console.error('Buddy start notify failed:', err.message);
      }
      return;
    }

    if (sub === 'end') {
      const session = sessions.getActiveSession(interaction.user.id, interaction.guildId);
      if (!session) {
        return interaction.reply({ content: 'No active session to end. Use `/session start` first.', ephemeral: true });
      }
      const elapsed = Math.floor(Date.now() / 1000) - session.started_at;
      await interaction.reply({
        embeds: [embed('Wrap up your session',
          `Active for ${fmtDuration(elapsed)}. Click **End Session** to record details, or **Cancel** to abandon.`,
          COLORS.primary)],
        components: [endSessionRow(session.id)],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'cancel') {
      const session = sessions.getActiveSession(interaction.user.id, interaction.guildId);
      if (!session) {
        return interaction.reply({ content: 'No active session to cancel.', ephemeral: true });
      }
      sessions.cancelSession(session.id);
      audit.log(interaction.guildId, interaction.user.id, 'session.cancel', { sessionId: session.id });
      return interaction.reply({ embeds: [embed('Session Cancelled', 'Not recorded.', COLORS.warning)], ephemeral: true });
    }

    if (sub === 'status') {
      const target = interaction.options.getUser('user') || interaction.user;
      if (target.id !== interaction.user.id) {
        if (!privacy.canViewer(interaction.user.id, target.id, interaction.guildId, 'sessions')) {
          return interaction.reply({ content: privacy.denyMessage(), ephemeral: true });
        }
      }
      const session = sessions.getActiveSession(target.id, interaction.guildId);
      if (!session) {
        return interaction.reply({ content: `${target.displayName} isn't currently checked in.`, ephemeral: true });
      }
      const elapsed = Math.floor(Date.now() / 1000) - session.started_at;
      const e = new EmbedBuilder()
        .setTitle(`🟢 ${target.displayName} is checked in`)
        .setColor(COLORS.success)
        .addFields(
          { name: 'Duration', value: fmtDuration(elapsed), inline: true },
          { name: 'Type', value: session.session_type || '—', inline: true },
          { name: 'Started', value: `<t:${session.started_at}:R>`, inline: true },
        )
        .setTimestamp();
      if (session.location) e.addFields({ name: 'Location', value: session.location });
      if (session.planned_activities) e.addFields({ name: 'Plan', value: session.planned_activities });
      return interaction.reply({ embeds: [e], ephemeral: true });
    }

    if (sub === 'history') {
      const limit = interaction.options.getInteger('limit') || 10;
      const rows = sessions.getRecent(interaction.user.id, interaction.guildId, limit);
      if (rows.length === 0) {
        return interaction.reply({ content: 'No sessions logged yet.', ephemeral: true });
      }
      const e = new EmbedBuilder()
        .setTitle(`📋 Recent Sessions - ${interaction.user.displayName}`)
        .setColor(COLORS.primary).setTimestamp();
      for (const r of rows) {
        const date = new Date(r.started_at * 1000).toLocaleDateString();
        const ended = r.ended_at ? fmtDuration(r.duration_sec) : '🟢 active';
        const lines = [`**${ended}** · ${r.session_type || 'session'}${r.location ? ` · ${r.location}` : ''}`];
        if (r.calories_est) lines.push(`${r.calories_est} kcal · intensity ${r.intensity || '—'}/10`);
        if (r.activities) lines.push(r.activities);
        e.addFields({ name: `#${r.id} — ${date}`, value: lines.join('\n').slice(0, 1000) });
      }
      return interaction.reply({ embeds: [e], ephemeral: true });
    }
  },
};
