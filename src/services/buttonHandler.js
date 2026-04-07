const handlers = {};

function registerButton(prefix, handler) {
  handlers[prefix] = handler;
}

async function handleButton(interaction) {
  const customId = interaction.customId;
  const prefix = customId.split('|')[0];
  const handler = handlers[prefix];
  if (handler) {
    await handler(interaction);
  }
}

module.exports = { registerButton, handleButton };
