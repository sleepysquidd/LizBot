const commando = require('discord.js-commando');
const ytdl = require('ytdl-core');

module.exports = class PlayCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'skip',
            group: 'music',
            memberName: 'skip',
            description: 'Skips a currently playing song'
        });
    }

    async run(msg, client, serverQueue) {
        if(!serverQueue) return msg.channel.send(`There is nothing to skip!`);
        serverQueue.connection.dispaher.end();
        }
}