const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits,
} = require('discord.js');
const { setGuildConfig } = require('../../services/database');
const { registerButton } = require('../../services/buttonHandler');
const { COLORS } = require('../../utils/helpers');

// ─── Persistent panel button handlers (these survive bot restarts via customId) ───

registerButton('panel_fitness', async (interaction) => {
  // Defer then load the hub dynamically to avoid circular deps
  await interaction.deferReply({ ephemeral: true });
  const { openFitnessHub } = require('./hub');
  await openFitnessHub(interaction);
});

registerButton('panel_log', async (interaction) => {
  await interaction.deferReply({ ephemeral: true });
  const logCmd = interaction.client.commands.get('log');
  // Send them to the quick-log flow
  await interaction.followUp({
    content: 'Use `/log` to log a workout, or `/fitness` for the full hub!',
    ephemeral: true,
  });
});

registerButton('panel_calc', async (interaction) => {
  await interaction.reply({
    content: 'Use these calculator commands:\n• `/calc bmi` — BMI Calculator\n• `/calc tdee` — TDEE / BMR Calculator\n• `/calc 1rm` — 1 Rep Max Calculator',
    ephemeral: true,
  });
});

registerButton('panel_challenge', async (interaction) => {
  await interaction.reply({
    content: 'Use these challenge commands:\n• `/challenge create` — Start a new challenge\n• `/challenge list` — View active challenges\n• `/challenge submit` — Log challenge progress\n• `/challenge leaderboard` — View rankings',
    ephemeral: true,
  });
});

registerButton('panel_social', async (interaction) => {
  await interaction.reply({
    content: 'Social features:\n• `/leaderboard` — Server fitness rankings\n• `/partner request` — Find an accountability partner\n• `/milestones` — View earned milestones & roles',
    ephemeral: true,
  });
});

// ─── Bot description and command listing ───

const FEATURE_SECTIONS = [
  {
    name: '🏋️ Workout Tracking',
    commands: [
      { cmd: '/fitness', desc: 'Open the fitness hub — access all features from one place' },
      { cmd: '/log', desc: 'Log an exercise with sets, reps, and weight' },
      { cmd: '/history', desc: 'View your workout history' },
      { cmd: '/pr', desc: 'View your personal records' },
      { cmd: '/streak', desc: 'Check your workout consistency streak' },
    ],
  },
  {
    name: '📊 Body & Nutrition',
    commands: [
      { cmd: '/body log', desc: 'Log body weight and measurements' },
      { cmd: '/body progress', desc: 'View measurement progress over time' },
      { cmd: '/nutrition log', desc: 'Track calories and macros' },
      { cmd: '/water add', desc: 'Log water intake' },
      { cmd: '/sleep log', desc: 'Track sleep and recovery' },
    ],
  },
  {
    name: '🎯 Goals & Plans',
    commands: [
      { cmd: '/goal set', desc: 'Set fitness goals with deadlines' },
      { cmd: '/plan', desc: 'Get a structured workout plan (PPL, Full Body, etc.)' },
      { cmd: '/random-workout', desc: 'Generate a random workout' },
      { cmd: '/exercise', desc: 'Look up form tips and muscle groups' },
    ],
  },
  {
    name: '🏆 Challenges & Social',
    commands: [
      { cmd: '/challenge create', desc: 'Start a server-wide fitness challenge' },
      { cmd: '/leaderboard', desc: 'View server fitness leaderboards' },
      { cmd: '/partner', desc: 'Accountability partner system' },
      { cmd: '/milestones', desc: 'View milestone role rewards' },
    ],
  },
  {
    name: '🔧 Tools',
    commands: [
      { cmd: '/calc', desc: 'BMI, TDEE, and 1RM calculators' },
      { cmd: '/stats', desc: 'Quick fitness summary (week/month/all-time)' },
      { cmd: '/convert', desc: 'Unit converter with plate math' },
      { cmd: '/timer', desc: 'Rest timer between sets' },
      { cmd: '/reminder', desc: 'Set workout reminders' },
      { cmd: '/recipe', desc: 'Recipe suggestions by diet and macros (50+)' },
      { cmd: '/quote', desc: 'Motivational fitness quotes' },
      { cmd: '/profile', desc: 'View or set up your fitness profile' },
    ],
  },
];

function buildPanelEmbeds() {
  const main = new EmbedBuilder()
    .setTitle('🐻 Fort Comme Un Ours — Fitness Tracker')
    .setDescription(
      '*Strong as a Bear*\n\n' +
      'Your complete fitness companion for Discord. Track workouts, set goals, ' +
      'join challenges, and crush your fitness journey with your server.\n\n' +
      '**Getting Started:** Use the buttons below or run `/fitness` to open the hub.\n' +
      'All responses are **private to you** unless you choose to publish them.'
    )
    .setColor(COLORS.fire)
    .setTimestamp();

  for (const section of FEATURE_SECTIONS) {
    const lines = section.commands.map(c => `\`${c.cmd}\` — ${c.desc}`).join('\n');
    main.addFields({ name: section.name, value: lines });
  }

  main.setFooter({ text: 'Use the buttons below or any slash command directly.' });

  return [main];
}

function buildPanelButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('panel_fitness')
      .setLabel('Open Fitness Hub')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🏋️'),
    new ButtonBuilder()
      .setCustomId('panel_challenge')
      .setLabel('Challenges')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🏆'),
    new ButtonBuilder()
      .setCustomId('panel_social')
      .setLabel('Social')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('👥'),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('panel_calc')
      .setLabel('Calculators')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔢'),
    new ButtonBuilder()
      .setCustomId('panel_log')
      .setLabel('Quick Log')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📝'),
  );

  return [row1, row2];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('initializefortcommeunours')
    .setDescription('Post the bot command panel in this channel (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to post the panel in (defaults to current channel)'))
    .addRoleOption(opt =>
      opt.setName('fitness_role')
        .setDescription('Role to ping when users publish their stats')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const fitnessRole = interaction.options.getRole('fitness_role');

    // Save guild config
    setGuildConfig(interaction.guildId, 'fitness_channel_id', targetChannel.id);
    if (fitnessRole) {
      setGuildConfig(interaction.guildId, 'fitness_role_id', fitnessRole.id);
    }

    // Post the panel
    try {
      await targetChannel.send({
        embeds: buildPanelEmbeds(),
        components: buildPanelButtons(),
      });

      let confirmMsg = `Panel posted in <#${targetChannel.id}>!`;
      if (fitnessRole) {
        confirmMsg += `\nFitness role set to ${fitnessRole.toString()} — this role will be pinged when users publish.`;
      }
      confirmMsg += '\n\nThe panel buttons will work even after bot restarts.';

      await interaction.editReply({ content: confirmMsg });
    } catch (err) {
      await interaction.editReply({
        content: `Failed to post panel: ${err.message}. Make sure the bot has permission to send messages in that channel.`,
      });
    }
  },

  // Export for re-registration on ready
  buildPanelButtons,
};
