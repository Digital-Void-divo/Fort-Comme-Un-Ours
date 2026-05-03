const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { getDb } = require('../../services/database');
const prService = require('../../services/prService');
const buddies = require('../../services/buddyService');
const privacy = require('../../services/privacyService');
const audit = require('../../services/auditService');
const recordTypes = require('../../data/recordTypes');
const { COLORS, embed, successEmbed, publishButton, safeDM, titleCase } = require('../../utils/helpers');
const { cacheEmbed, registerButton } = require('../../services/buttonHandler');

const RECORD_TYPE_CHOICES = [
  { name: 'Weight (heaviest)', value: 'weight' },
  { name: 'Reps (most unbroken)', value: 'reps' },
  { name: 'Duration (longest hold)', value: 'duration' },
  { name: 'Distance (longest)', value: 'distance' },
  { name: 'Time (fastest)', value: 'time' },
];

function fmtDuration(sec) {
  if (sec == null) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (m) return `${m}:${String(s).padStart(2, '0')}`;
  return `${s}s`;
}

function parseDurationInput(str) {
  if (!str) return null;
  const trimmed = str.trim();
  // Accept "mm:ss", "h:mm:ss", "90s", "1m30s", or plain seconds.
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  const colon = trimmed.split(':').map(s => parseInt(s, 10));
  if (colon.every(n => !Number.isNaN(n))) {
    if (colon.length === 2) return colon[0] * 60 + colon[1];
    if (colon.length === 3) return colon[0] * 3600 + colon[1] * 60 + colon[2];
  }
  let total = 0;
  const re = /(\d+)\s*(h|hr|hours?|m|min|minutes?|s|sec|seconds?)/gi;
  let match; let any = false;
  while ((match = re.exec(trimmed)) !== null) {
    any = true;
    const v = parseInt(match[1], 10);
    const u = match[2].toLowerCase();
    if (u.startsWith('h')) total += v * 3600;
    else if (u.startsWith('m')) total += v * 60;
    else total += v;
  }
  return any ? total : null;
}

function fmtPrValue(pr) {
  switch (pr.record_type) {
    case 'weight':
      return `**${pr.weight} ${pr.weight_unit}** × ${pr.reps ?? 1}`;
    case 'reps':
      return `**${pr.reps} reps**`;
    case 'duration':
      return `**${fmtDuration(pr.duration_sec)}**`;
    case 'distance':
      return `**${pr.distance} ${pr.distance_unit || ''}**`.trim();
    case 'time':
      return `**${fmtDuration(pr.time_sec)}**`;
    default:
      return `**${pr.value ?? '?'}${pr.value_unit ? ' ' + pr.value_unit : ''}**`;
  }
}

function validationButtons(prId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pr_approve|${prId}`).setLabel('Approve').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId(`pr_reject|${prId}`).setLabel('Reject').setStyle(ButtonStyle.Danger).setEmoji('❌'),
  );
}

async function processValidation(interaction, approve) {
  const prId = parseInt(interaction.customId.split('|')[1], 10);
  const pr = prService.getById(prId);
  if (!pr) return interaction.reply({ content: 'Record not found.', ephemeral: true });
  if (pr.status !== 'pending') return interaction.reply({ content: 'This record has already been resolved.', ephemeral: true });

  // Confirm the validator is actually an active buddy
  const isBuddy = privacy.isActiveBuddy(interaction.user.id, pr.user_id, pr.guild_id);
  if (!isBuddy) {
    return interaction.reply({ content: 'You can only validate records for users you\'re an active buddy with.', ephemeral: true });
  }
  if (interaction.user.id === pr.user_id) {
    return interaction.reply({ content: 'You can\'t self-validate your own record.', ephemeral: true });
  }

  let result, statusEmbed;
  if (approve) {
    result = prService.approve(prId, interaction.user.id);
    if (!result.ok) return interaction.reply({ content: 'Could not approve.', ephemeral: true });
    audit.log(pr.guild_id, interaction.user.id, 'pr.approve', { prId, athlete: pr.user_id, isImprovement: result.isImprovement });
    const supersededLine = result.previous && result.isImprovement
      ? `\nPrevious: ${fmtPrValue(result.previous)}`
      : (result.previous && !result.isImprovement
          ? `\n*(Recorded but not a new best — current best stands.)*`
          : '');
    statusEmbed = successEmbed('✅ PR Approved',
      `<@${pr.user_id}>'s **${pr.exercise}** record was approved.\n${fmtPrValue(pr)}${supersededLine}`);
  } else {
    result = prService.reject(prId, interaction.user.id);
    if (!result.ok) return interaction.reply({ content: 'Could not reject.', ephemeral: true });
    audit.log(pr.guild_id, interaction.user.id, 'pr.reject', { prId, athlete: pr.user_id });
    statusEmbed = embed('❌ PR Rejected',
      `<@${pr.user_id}>'s **${pr.exercise}** record was rejected.\n${fmtPrValue(pr)}`,
      COLORS.error);
  }

  try { await interaction.update({ embeds: [statusEmbed], components: [] }); }
  catch { try { await interaction.reply({ embeds: [statusEmbed], ephemeral: true }); } catch { /* ignore */ } }

  // Notify the athlete and other buddies that decision was made
  try {
    const athlete = await interaction.client.users.fetch(pr.user_id);
    await safeDM(athlete, { embeds: [statusEmbed] });
  } catch { /* ignore */ }
}

registerButton('pr_approve', (i) => processValidation(i, true));
registerButton('pr_reject', (i) => processValidation(i, false));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pr')
    .setDescription('Personal records — submit, validate, and view')
    .addSubcommand(sub =>
      sub.setName('view').setDescription('View personal records')
        .addUserOption(opt => opt.setName('user').setDescription('Whose PRs?')))
    .addSubcommand(sub =>
      sub.setName('submit').setDescription('Submit a PR for buddy validation')
        .addStringOption(opt => opt.setName('exercise').setDescription('Exercise / record name').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('record_type').setDescription('What\'s being measured').setRequired(true).addChoices(...RECORD_TYPE_CHOICES))
        .addNumberOption(opt => opt.setName('weight').setDescription('Weight (for weight records)'))
        .addStringOption(opt => opt.setName('weight_unit').setDescription('lbs or kg').addChoices({ name: 'lbs', value: 'lbs' }, { name: 'kg', value: 'kg' }))
        .addIntegerOption(opt => opt.setName('reps').setDescription('Reps performed'))
        .addStringOption(opt => opt.setName('duration').setDescription('Hold time (e.g. 2:30 or 150s)'))
        .addNumberOption(opt => opt.setName('distance').setDescription('Distance value'))
        .addStringOption(opt => opt.setName('distance_unit').setDescription('Distance unit (km, mi, m, ft, in)'))
        .addStringOption(opt => opt.setName('time').setDescription('Time / pace (e.g. 4:32 or 272s)'))
        .addStringOption(opt => opt.setName('evidence').setDescription('Optional photo/video URL'))
        .addStringOption(opt => opt.setName('notes').setDescription('Optional notes')))
    .addSubcommand(sub =>
      sub.setName('pending').setDescription('Show your pending submissions and validations'))
    .addSubcommand(sub =>
      sub.setName('cancel').setDescription('Cancel one of your pending submissions')
        .addIntegerOption(opt => opt.setName('id').setDescription('PR ID').setRequired(true))),

  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused().toLowerCase();
      const matches = Object.entries(recordTypes)
        .filter(([key, def]) => key.includes(focused) || def.label.toLowerCase().includes(focused))
        .slice(0, 25)
        .map(([key, def]) => ({ name: def.label, value: key }));
      await interaction.respond(matches);
    } catch (err) {
      console.error('PR autocomplete failed:', err.message);
    }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      await interaction.deferReply({ ephemeral: true });
      const target = interaction.options.getUser('user') || interaction.user;
      if (!privacy.canViewer(interaction.user.id, target.id, interaction.guildId, 'prs')) {
        return interaction.editReply({ content: privacy.denyMessage() });
      }
      const prs = prService.currentBests(target.id, interaction.guildId);
      if (prs.length === 0) {
        return interaction.editReply({ embeds: [embed('Personal Records', `No approved PRs for <@${target.id}> yet. Use \`/pr submit\` and have a buddy validate.`, COLORS.warning)] });
      }
      const e = new EmbedBuilder()
        .setTitle(`🏆 Personal Records — ${target.displayName}`)
        .setColor(COLORS.gold).setTimestamp();
      for (const pr of prs.slice(0, 25)) {
        const def = recordTypes[pr.exercise];
        const name = def?.label || titleCase(pr.exercise);
        const date = new Date((pr.validated_at || pr.created_at) * 1000).toLocaleDateString();
        const validator = pr.validator_id ? `Validated by <@${pr.validator_id}>` : 'Self-recorded (legacy)';
        e.addFields({ name, value: `${fmtPrValue(pr)}\n${validator} · ${date}`, inline: true });
      }
      const cacheKey = `pr|${target.id}|${Date.now()}`;
      cacheEmbed(cacheKey, [e], interaction.guildId);
      return interaction.editReply({ embeds: [e], components: [publishButton(cacheKey)] });
    }

    if (sub === 'submit') {
      await interaction.deferReply({ ephemeral: true });

      const exercise = interaction.options.getString('exercise').toLowerCase().trim();
      const recordType = interaction.options.getString('record_type');
      const def = recordTypes[exercise];
      const weight = interaction.options.getNumber('weight');
      const weightUnit = interaction.options.getString('weight_unit') || 'lbs';
      const reps = interaction.options.getInteger('reps');
      const durationStr = interaction.options.getString('duration');
      const distance = interaction.options.getNumber('distance');
      const distanceUnit = interaction.options.getString('distance_unit') || (def?.defaultUnit && def.measurement === 'distance' ? def.defaultUnit : null);
      const timeStr = interaction.options.getString('time');
      const evidence = interaction.options.getString('evidence');
      const notes = interaction.options.getString('notes');

      const durationSec = parseDurationInput(durationStr);
      const timeSec = parseDurationInput(timeStr);

      // Validate that the right field for the record_type was filled
      const required = {
        weight: weight != null && reps != null,
        reps: reps != null,
        duration: durationSec != null && durationSec > 0,
        distance: distance != null && distance > 0,
        time: timeSec != null && timeSec > 0,
      }[recordType];
      if (!required) {
        const fieldHint = {
          weight: 'weight + reps', reps: 'reps',
          duration: 'duration (e.g. `2:30` or `150s`)',
          distance: 'distance + distance_unit',
          time: 'time (e.g. `4:32` or `272s`)',
        }[recordType];
        return interaction.editReply({ content: `Please provide ${fieldHint} for a ${recordType} record.` });
      }

      // Buddy required — no self-attested PRs.
      const buddyIds = buddies.getActiveBuddyIds(interaction.user.id, interaction.guildId);
      if (buddyIds.length === 0) {
        return interaction.editReply({
          embeds: [embed('Need a Buddy First',
            'PR submissions need an active accountability buddy to validate them. Use `/partner request` to set one up.',
            COLORS.warning)],
        });
      }

      const prId = prService.createPending({
        userId: interaction.user.id, guildId: interaction.guildId, exercise,
        recordType,
        weight, weightUnit, reps,
        durationSec, distance, distanceUnit, timeSec,
        evidenceUrl: evidence, notes,
      });
      audit.log(interaction.guildId, interaction.user.id, 'pr.submit', { prId, exercise, recordType });

      // Build review embed
      const valueLine = (() => {
        const dummy = { record_type: recordType, weight, weight_unit: weightUnit, reps, duration_sec: durationSec, distance, distance_unit: distanceUnit, time_sec: timeSec };
        return fmtPrValue(dummy);
      })();
      const review = new EmbedBuilder()
        .setTitle('🏆 PR Awaiting Validation')
        .setColor(COLORS.gold)
        .setDescription(
          `**Athlete:** <@${interaction.user.id}>\n` +
          `**Exercise:** ${def?.label || exercise}\n` +
          `**Result:** ${valueLine}` +
          (notes ? `\n**Notes:** ${notes}` : '') +
          (evidence ? `\n**Evidence:** ${evidence}` : '')
        )
        .setFooter({ text: 'Buddies — approve or reject this submission.' })
        .setTimestamp();

      // DM all active buddies with approve/reject buttons
      const messageIds = {};
      let dmAny = false;
      for (const bid of buddyIds) {
        try {
          const buddyUser = await interaction.client.users.fetch(bid);
          const dm = await buddyUser.createDM();
          const msg = await dm.send({ embeds: [review], components: [validationButtons(prId)] });
          messageIds[bid] = { channelId: dm.id, messageId: msg.id };
          dmAny = true;
        } catch (err) {
          console.error(`Failed to DM buddy ${bid} for PR validation:`, err.message);
        }
      }
      prService.setValidationMessages(prId, messageIds);

      const replyDesc = dmAny
        ? `Sent to ${Object.keys(messageIds).length} buddy/buddies for validation. You'll be notified when they respond.`
        : 'Could not DM any of your buddies — ask them to use `/pr pending` to find your submission.';
      return interaction.editReply({
        embeds: [embed('Submission Sent', replyDesc + `\nID: \`#${prId}\``, COLORS.success)],
      });
    }

    if (sub === 'pending') {
      await interaction.deferReply({ ephemeral: true });
      const mySubs = getDb().prepare(
        `SELECT * FROM personal_records WHERE user_id = ? AND guild_id = ? AND status = 'pending' ORDER BY created_at DESC`
      ).all(interaction.user.id, interaction.guildId);
      const toValidate = prService.pendingFor(interaction.user.id, interaction.guildId);

      const e = new EmbedBuilder().setTitle('⏳ PR Pending Queue').setColor(COLORS.warning).setTimestamp();
      if (mySubs.length) {
        e.addFields({
          name: `Your Submissions (${mySubs.length})`,
          value: mySubs.map(p => `#${p.id} — ${recordTypes[p.exercise]?.label || p.exercise}: ${fmtPrValue(p)} · sent <t:${p.created_at}:R>`).join('\n').slice(0, 1024),
        });
      }
      if (toValidate.length) {
        e.addFields({
          name: `Awaiting Your Validation (${toValidate.length})`,
          value: toValidate.map(p => `#${p.id} — <@${p.user_id}> · ${recordTypes[p.exercise]?.label || p.exercise}: ${fmtPrValue(p)}`).join('\n').slice(0, 1024),
        });
      }
      if (!mySubs.length && !toValidate.length) {
        e.setDescription('Nothing pending.');
      }

      // Buttons for the validation queue (max 5 per row)
      const components = [];
      if (toValidate.length) {
        for (const p of toValidate.slice(0, 5)) {
          components.push(validationButtons(p.id));
        }
      }
      return interaction.editReply({ embeds: [e], components });
    }

    if (sub === 'cancel') {
      const id = interaction.options.getInteger('id');
      const pr = prService.getById(id);
      if (!pr || pr.user_id !== interaction.user.id) {
        return interaction.reply({ content: 'PR not found or not yours.', ephemeral: true });
      }
      if (pr.status !== 'pending') {
        return interaction.reply({ content: 'Only pending submissions can be cancelled.', ephemeral: true });
      }
      getDb().prepare(
        `UPDATE personal_records SET status = 'expired' WHERE id = ?`
      ).run(id);
      audit.log(interaction.guildId, interaction.user.id, 'pr.cancel', { prId: id });
      return interaction.reply({ embeds: [embed('Submission Cancelled', `PR #${id} cancelled.`, COLORS.warning)], ephemeral: true });
    }
  },
};
