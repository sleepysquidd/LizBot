const commando = require('discord.js-commando');
const ytdl = require('ytdl-core');

const queue = new Map();

module.exports = class PlayCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'stop',
            group: 'music',
            memberName: 'stop',
            description: 'Stops the current playing song'
        });
    }

    async run(msg, client) {
        if(!msg.member.voiceChannel) {
            return msg.channel.send(`You aren't in a voice channel!`);
        }
        msg.member.voiceChannel.leave();
        }
}