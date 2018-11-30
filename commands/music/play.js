const commando = require('discord.js-commando');
const ytdl = require('ytdl-core');

const queue = new Map();

module.exports = class PlayCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'play',
            group: 'music',
            memberName: 'play',
            description: 'Plays a song from a youtube url'
        });
    }

    async run(msg, client) {
        const args = msg.content.split(" ");
        const serverQueue = queue.get(msg.guild.id);
        const voiceChannel = msg.member.voiceChannel;

        if(!voiceChannel) return msg.channel.send("You need to be in a voice channel to play music!");
            const permissions = voiceChannel.permissionsFor(msg.client.user);
            if(!permissions.has('CONNECT')) return msg.channel.send('I need connect permissions!');
            if(!permissions.has('SPEAK')) return msg.channel.send('I need speaking permissions!');

            const songInfo = await ytdl.getInfo(args[1]);
            const song = {
                title: songInfo.title,
                url: songInfo.video_url
            };

            if(!serverQueue) {
                const queueConstruct = {
                    textChannel: msg.channel,
                    voiceChannel: voiceChannel,
                    connection: null,
                    songs: [],
                    volume: 5,
                    playing: true
                };
                queue.set(msg.guild.id, queueConstruct);

                queueConstruct.songs.push(song);

                try {
                    var connection = await voiceChannel.join();
                    queueConstruct.connection = connection;
                    play(msg.guild, queueConstruct.songs[0]);
                } catch(error) {
                    console.error(`Couldn't join channel: ${error}`);
                    queue.delete(msg.guild.id);
                    return msg.channel.send(`I couldn't join the voice channel: ${error}`);
                }
            } else {
                serverQueue.songs.push(song);
                return msg.channel.send(`**${song.title}** has been added to the queue!`);
            }
        }
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    
    if(!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }
    console.log(serverQueue.songs);

    const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
    .on('end', () => {
        msg.channel.send(`**${song.title}** ended!`);
        serverQueue.songs.shift();
        play(guild, serverQueue.songs[0]);
    })
    .on('error', error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume/5);
}