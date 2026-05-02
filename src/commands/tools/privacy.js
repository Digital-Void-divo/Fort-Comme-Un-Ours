const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const privacy = require('../../services/privacyService');
const audit = require('../../services/auditService');
const { COLORS, embed } = require('../../utils/helpers');

const VISIBILITY_CHOICES = [
  { name: 'Public — anyone in this server', value: 'public' },
  { name: 'Buddies only — only my accountability buddies', value: 'buddies' },
  { name: 'Private — nobody (unless buddy bypass is on)', value: 'private' },
];

const YN = [{ name: 'Yes', value: 'yes' }, { name: 'No', value: 'no' }];

function yn(v) { return v ? '✅ Yes' : '❌ No'; }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('privacy')
    .setDescription('Control who can see your fitness data and how buddies interact with you')
    .addSubcommand(sub =>
      sub.setName('view').setDescription('Show your current privacy settings'))
    .addSubcommand(sub =>
      sub.setName('visibility').setDescription('Who can see your data by default')
        .addStringOption(opt => opt.setName('level').setDescription('Visibility level').setRequired(true).addChoices(...VISIBILITY_CHOICES)))
    .addSubcommand(sub =>
      sub.setName('buddy_bypass').setDescription('Let your accountability buddies bypass your privacy settings')
        .addStringOption(opt => opt.setName('value').setDescription('Yes or No').setRequired(true).addChoices(...YN)))
    .addSubcommand(sub =>
      sub.setName('tag').setDescription('Allow being tagged via /buddyshout')
        .addStringOption(opt => opt.setName('value').setDescription('Yes or No').setRequired(true).addChoices(...YN)))
    .addSubcommand(sub =>
      sub.setName('notify').setDescription('Configure buddy notifications')
        .addStringOption(opt => opt.setName('event').setDescription('Notification type').setRequired(true).addChoices(
          { name: 'When I log a workout', value: 'workout' },
          { name: 'When I submit a PR', value: 'pr' },
          { name: 'When I update a goal', value: 'goal' },
          { name: 'When I start/end a session', value: 'session' },
          { name: 'When I miss my streak', value: 'missed_streak' },
        ))
        .addStringOption(opt => opt.setName('value').setDescription('Yes or No').setRequired(true).addChoices(...YN)))
    .addSubcommand(sub =>
      sub.setName('guild_stats').setDescription('Include your data in anonymized server-wide /guildstats')
        .addStringOption(opt => opt.setName('value').setDescription('Yes or No').setRequired(true).addChoices(...YN))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    privacy.ensureProfileRow(userId, guildId);

    if (sub === 'view') {
      const s = privacy.getSettings(userId, guildId);
      const e = new EmbedBuilder()
        .setTitle('🔒 Your Privacy Settings')
        .setColor(COLORS.primary)
        .addFields(
          { name: 'Default Visibility', value: s.visibility, inline: true },
          { name: 'Buddies Bypass Privacy', value: yn(s.buddyBypass), inline: true },
          { name: 'Tag Me in /buddyshout', value: yn(s.tagInMessages), inline: true },
          { name: 'Notify Buddies — Workouts', value: yn(s.notifyBuddyOnWorkout), inline: true },
          { name: 'Notify Buddies — PRs', value: yn(s.notifyBuddyOnPR), inline: true },
          { name: 'Notify Buddies — Goals', value: yn(s.notifyBuddyOnGoal), inline: true },
          { name: 'Notify Buddies — Sessions', value: yn(s.notifyBuddyOnSession), inline: true },
          { name: 'Notify Buddies — Missed Streak', value: yn(s.notifyBuddyOnMissedStreak), inline: true },
          { name: 'Include in /guildstats', value: yn(s.includeInGuildStats), inline: true },
        )
        .setTimestamp();
      return interaction.reply({ embeds: [e], ephemeral: true });
    }

    if (sub === 'visibility') {
      const level = interaction.options.getString('level');
      privacy.setSetting(userId, guildId, 'visibility_default', level);
      audit.log(guildId, userId, 'privacy.visibility', { level });
      return interaction.reply({ embeds: [embed('Visibility Updated', `Default visibility set to **${level}**.`, COLORS.success)], ephemeral: true });
    }

    const yesNoSubs = {
      buddy_bypass: 'buddy_bypass_privacy',
      tag: 'tag_in_messages',
      guild_stats: 'include_in_guild_stats',
    };
    if (yesNoSubs[sub]) {
      const value = interaction.options.getString('value') === 'yes' ? 1 : 0;
      privacy.setSetting(userId, guildId, yesNoSubs[sub], value);
      audit.log(guildId, userId, `privacy.${sub}`, { value });
      return interaction.reply({ embeds: [embed('Privacy Updated', `Setting saved.`, COLORS.success)], ephemeral: true });
    }

    if (sub === 'notify') {
      const event = interaction.options.getString('event');
      const value = interaction.options.getString('value') === 'yes' ? 1 : 0;
      const col = `notify_buddy_on_${event}`;
      privacy.setSetting(userId, guildId, col, value);
      audit.log(guildId, userId, 'privacy.notify', { event, value });
      return interaction.reply({ embeds: [embed('Notification Setting Updated', `Buddy notify on **${event}** = **${value ? 'on' : 'off'}**.`, COLORS.success)], ephemeral: true });
    }
  },
};
