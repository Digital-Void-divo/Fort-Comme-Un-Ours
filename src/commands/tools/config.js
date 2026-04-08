const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../../services/database');
const { COLORS, embed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure bot settings for this server (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('quote-channel')
        .setDescription('Set the channel for daily motivational quotes')
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Channel for quotes').setRequired(true)
            .addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sub =>
      sub.setName('fitness-role')
        .setDescription('Set the role pinged when users publish stats')
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to ping').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current bot configuration')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'quote-channel') {
      const channel = interaction.options.getChannel('channel');
      setGuildConfig(interaction.guildId, 'fitness_channel_id', channel.id);

      await interaction.reply({
        embeds: [embed('Config Updated', `Daily quotes will post to <#${channel.id}> at 8 AM UTC.`, COLORS.success)],
        ephemeral: true,
      });

    } else if (sub === 'fitness-role') {
      const role = interaction.options.getRole('role');
      setGuildConfig(interaction.guildId, 'fitness_role_id', role.id);

      await interaction.reply({
        embeds: [embed('Config Updated', `${role.toString()} will be pinged when users publish their stats.`, COLORS.success)],
        ephemeral: true,
      });

    } else if (sub === 'view') {
      const channelId = getGuildConfig(interaction.guildId, 'fitness_channel_id');
      const roleId = getGuildConfig(interaction.guildId, 'fitness_role_id');

      const lines = [
        `**Quote Channel:** ${channelId ? `<#${channelId}>` : 'Not set (falls back to any channel named "fitness" or "motivation")'}`,
        `**Fitness Role:** ${roleId ? `<@&${roleId}>` : 'Not set (publish buttons won\'t ping a role)'}`,
      ];

      await interaction.reply({
        embeds: [embed('Server Config', lines.join('\n'), COLORS.primary)],
        ephemeral: true,
      });
    }
  },
};
