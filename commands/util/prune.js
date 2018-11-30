const commando = require('discord.js-commando');
module.exports = class PruneCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'prune',
            group: 'util',
            memberName: 'prune',
            description: 'Prune messages',
            example: ['prune 5']
        });
    }

    async run(message) {
        const params = Number(message.content.split(" ").slice(1));
        if (isNaN(params)) {
            message.channel.bulkDelete(await message.channel.fetchMessages({limit: 2}));
        } else {
            message.channel.bulkDelete(await message.channel.fetchMessages({limit: params+1}));
        }
    }
}