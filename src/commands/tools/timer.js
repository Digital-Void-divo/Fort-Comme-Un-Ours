const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, embed } = require('../../utils/helpers');
const { registerButton } = require('../../services/buttonHandler');

// Active timers stored in memory (not persisted — they're short-lived)
const activeTimers = new Map();

registerButton('timer_cancel', async (interaction) => {
  const key = interaction.customId.split('|')[1];
  const timer = activeTimers.get(key);
  if (timer) {
    clearTimeout(timer.timeout);
    activeTimers.delete(key);
    await interaction.update({
      embeds: [embed('⏱️ Timer Cancelled', 'Rest timer has been cancelled.', COLORS.warning)],
      components: [],
    });
  } else {
    await interaction.reply({ content: 'No active timer found.', ephemeral: true });
  }
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timer')
    .setDescription('Set a rest timer between sets')
    .addIntegerOption(opt =>
      opt.setName('seconds').setDescription('Rest time in seconds (default 90)').setMinValue(10).setMaxValue(600))
    .addStringOption(opt =>
      opt.setName('preset').setDescription('Use a preset timer').addChoices(
        { name: '30s (Short rest)', value: '30' },
        { name: '60s (Standard)', value: '60' },
        { name: '90s (Moderate)', value: '90' },
        { name: '120s (Long rest)', value: '120' },
        { name: '180s (Strength)', value: '180' },
        { name: '300s (Max strength)', value: '300' },
      )),

  async execute(interaction) {
    const preset = interaction.options.getString('preset');
    const seconds = preset ? parseInt(preset) : (interaction.options.getInteger('seconds') || 90);

    const key = `${interaction.user.id}|${Date.now()}`;
    const endTime = Math.floor(Date.now() / 1000) + seconds;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`timer_cancel|${key}`)
        .setLabel('Cancel Timer')
        .setStyle(ButtonStyle.Danger)
    );

    const e = new EmbedBuilder()
      .setTitle('⏱️ Rest Timer Started')
      .setDescription(`Resting for **${seconds}s**\nEnds <t:${endTime}:R>`)
      .setColor(COLORS.primary)
      .setTimestamp();

    await interaction.reply({ embeds: [e], components: [row] });

    const timeout = setTimeout(async () => {
      activeTimers.delete(key);
      try {
        const doneEmbed = embed('⏱️ Rest Over!', `<@${interaction.user.id}> Your **${seconds}s** rest is over — get back to it!`, COLORS.fire);
        await interaction.followUp({ content: `<@${interaction.user.id}>`, embeds: [doneEmbed] });
        // Remove cancel button
        await interaction.editReply({ components: [] });
      } catch (err) {
        console.error('Timer completion notification failed:', err.message);
      }
    }, seconds * 1000);

    activeTimers.set(key, { timeout, userId: interaction.user.id });
  },
};
