const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { COLORS, embed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('progress-photo')
    .setDescription('Upload and view progress photos')
    .addSubcommand(sub =>
      sub.setName('upload')
        .setDescription('Upload a progress photo')
        .addAttachmentOption(opt =>
          opt.setName('photo').setDescription('Your progress photo').setRequired(true))
        .addStringOption(opt =>
          opt.setName('caption').setDescription('Caption for your photo')))
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View your progress photos')
        .addUserOption(opt =>
          opt.setName('user').setDescription('View another user\'s photos'))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'upload') {
      await interaction.deferReply({ ephemeral: true });
      const attachment = interaction.options.getAttachment('photo');
      const caption = interaction.options.getString('caption') || null;

      if (!attachment.contentType?.startsWith('image/')) {
        return interaction.editReply({ content: 'Please upload an image file.', ephemeral: true });
      }

      db.prepare(
        'INSERT INTO progress_photos (user_id, guild_id, url, caption) VALUES (?, ?, ?, ?)'
      ).run(interaction.user.id, interaction.guildId, attachment.url, caption);

      const count = db.prepare(
        'SELECT COUNT(*) as count FROM progress_photos WHERE user_id = ? AND guild_id = ?'
      ).get(interaction.user.id, interaction.guildId);

      const e = new EmbedBuilder()
        .setTitle('📸 Progress Photo Uploaded')
        .setImage(attachment.url)
        .setColor(COLORS.success)
        .setTimestamp();

      if (caption) e.setDescription(caption);
      e.setFooter({ text: `Photo #${count.count}` });

      await interaction.editReply({ embeds: [e] });

    } else if (sub === 'view') {
      await interaction.deferReply({ ephemeral: true });
      const target = interaction.options.getUser('user') || interaction.user;

      const photos = db.prepare(
        'SELECT * FROM progress_photos WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT 5'
      ).all(target.id, interaction.guildId);

      if (photos.length === 0) {
        return interaction.editReply({
          embeds: [embed('Progress Photos', `No progress photos for <@${target.id}>. Use \`/progress-photo upload\` to add one!`, COLORS.warning)]
        });
      }

      const embeds = photos.map((p, i) => {
        const date = new Date(p.created_at * 1000).toLocaleDateString();
        const e = new EmbedBuilder()
          .setImage(p.url)
          .setColor(COLORS.primary)
          .setFooter({ text: `${date}${p.caption ? ` — ${p.caption}` : ''}` });
        if (i === 0) e.setTitle(`📸 Progress Photos — ${target.displayName}`);
        return e;
      });

      await interaction.editReply({ embeds });
    }
  },
};
