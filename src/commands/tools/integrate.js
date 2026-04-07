const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS, embed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('integrate')
    .setDescription('Connect external fitness services')
    .addStringOption(opt =>
      opt.setName('service').setDescription('Service to connect').setRequired(true).addChoices(
        { name: 'Strava', value: 'strava' },
        { name: 'Fitbit', value: 'fitbit' },
        { name: 'Garmin', value: 'garmin' },
        { name: 'Apple Health', value: 'apple_health' },
      )),

  async execute(interaction) {
    const service = interaction.options.getString('service');
    const serviceNames = {
      strava: 'Strava',
      fitbit: 'Fitbit',
      garmin: 'Garmin Connect',
      apple_health: 'Apple Health',
    };

    const e = new EmbedBuilder()
      .setTitle(`🔗 ${serviceNames[service]} Integration`)
      .setDescription(
        `**${serviceNames[service]}** integration is coming soon!\n\n` +
        'This feature is on our roadmap. When available, you\'ll be able to:\n' +
        '• Automatically sync workouts and activities\n' +
        '• Import step count and heart rate data\n' +
        '• Track runs, rides, and other activities\n\n' +
        'For now, you can manually log your workouts with `/log`.'
      )
      .setColor(COLORS.warning)
      .setTimestamp();

    await interaction.reply({ embeds: [e], ephemeral: true });
  },
};
