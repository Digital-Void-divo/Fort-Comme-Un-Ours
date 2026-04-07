const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const quotes = require('../../data/quotes');
const { COLORS } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quote')
    .setDescription('Get a motivational fitness quote'),

  async execute(interaction) {
    const quote = quotes[Math.floor(Math.random() * quotes.length)];

    const e = new EmbedBuilder()
      .setTitle('💪 Motivational Quote')
      .setDescription(`*"${quote.text}"*\n\n— **${quote.author}**`)
      .setColor(COLORS.gold)
      .setTimestamp();

    await interaction.reply({ embeds: [e] });
  },
};
