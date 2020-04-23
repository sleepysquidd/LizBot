const Discord = require('discord.js');
const config = require('./config.json');
const ytdl = require('ytdl-core');
const ytl = require('simple-youtube-api');
const GoogleImages = require('google-images');

const client = new Discord.Client();
const gClient = new GoogleImages('apikey',config.cseapi);
const queue = new Map();
const prefix = config.prefix;
const yt = new ytl(config.ytapi);

var maxVol = null;
const barrow = `◀`;
const farrow = `▶`;

client.on("ready", () => {
    console.log(`Starting Liz Bot with ${client.users.size} users in ${client.channels.size} channels within ${client.guilds.size} servers.`);
    client.user.setActivity(`Helping ${client.guilds.size} servers!`);
});

client.on("messageReactionAdd", (reaction, user) => {
    console.log(reaction.message.author);
    console.log("Reaction!");
});

client.on("guildMemberAdd", member => {
    const welcomeChannel = member.guild.channels.find('name', 'member-log');

    if (!welcomeChannel) {
        return;
    }

    console.log(`New member: ${member}`);
    welcomeChannel.send({embed: {
        color: 3066993,
        author: {
            name: member.user.username,
            icon_url: member.user.avatarURL,
        },
        title: "Member joined!",
        description: `${member.user.tag} joined the server!`,
        timestamp: new Date()
    }});
});

client.on("guildMemberRemove", member => {
    const welcomeChannel = member.guild.channels.find('name', 'member-log');

    if (!welcomeChannel) {
        return;
    }

    console.log(`Lost member: ${member}`);
    welcomeChannel.send({embed: {
        color: 3066993,
        author: {
            name: member.user.username,
            icon_url: member.user.avatarURL,
        },
        title: "Member left.",
        description: `${member.user.tag} left the server.`,
        timestamp: new Date()
    }});
});

client.on("messageDelete", async msg => {
    msg.channel.send(`${msg.author.username} deleted message: ${msg.content}`);
});

client.on("guildCreate", guild => {
    console.log(`Added to new server: ${guild.name} (id: ${guild.id}). Total members: ${guild.memberCount}.`);
    client.user.setActivity(`Helping ${client.guilds.size} servers!`);
    client.users.get(config.owner).sendMessage(`Added to new server: ${guild.name} (id: ${guild.id}). Total members: ${guild.memberCount}. Owner: ${guild.owner}.`);
});

client.on("guildDelete", guild => {
    console.log(`Removed from server: ${guild.name} (id: ${guild.id}). Total members: ${guild.memberCount}.`);
    client.user.setActivity(`Helping ${client.guilds.size} servers!`);
    client.users.get(config.owner).sendMessage(`Removed from server: ${guild.name} (id: ${guild.id}). Total members: ${guild.memberCount}. Owner: ${guild.owner}.`);
});

const commands = {
    "image": async function(args, msg) {
        if (args.length == 0) {
            return;
        }

        const searchString = args.join(" ");
        var imgs = await gClient.search(searchString);

        msg.channel.send({embed: {
            color: 100500,
            author: {
                name: client.user.username,
                icon_url: client.user.avatarURL,
            },
            title: "Search results for `" + searchString + "`",
            image: { url: `${imgs[0].url}` },
            footer: { text: `Total results: ${imgs.length}` }
        }});
    },

    "play": async function(args, msg) {
        if (args.length == 0) {
            msg.channel.send('Enter a search term or YouTube link!');
            return;
        }

        const searchString = args.join(" ");
        const url = args[0].replace(/<(.+)>/g, '$1');
        const vc = msg.member.voiceChannel;

        if (!vc) {
            msg.channel.send("You need to be in a voice channel to queue a song!");
            return;
        }

        const perms = vc.permissionsFor(msg.client.user);
        if (!perms.has('CONNECT')) {
            msg.channel.send('I am missing the connect permission!');
            return;
        }
        if (!perms.has('SPEAK')) {
            msg.channel.send('I am missing the speak permission!');
            return;
        }

        if (url.indexOf("playlist") != -1) {
            const pl = await yt.getPlaylist(url);
            const vids = await pl.getVideos();
            msg.channel.send(`Playlist addded with ${vids.length} songs!`);

            for (let x of vids) {
                const vid = await yt.getVideoByID(x.id);
                await queueVid(vid, msg, vc, true);
            }
        } else {
            var vid;
            try {
                vid = await yt.getVideo(url);
            } catch(e) {
                try {
                    var vidSearch = await yt.searchVideos(searchString, 1);
                    vid = await yt.getVideoByID(vidSearch[0].id);
                } catch(error) {
                     msg.channel.send("Couldn't find `" + args + "`");
                     return;
                }
            }
            queueVid(vid, msg, vc);
        }
    },

    "skip": function(args, msg, serverQueue) {
        if (!msg.member.voiceChannel) {
            msg.channel.send("You aren't in a voice channel!");
        } else if (!serverQueue) {
            msg.channel.send("There's nothing to skip!");
        } else {
            serverQueue.connection.dispatcher.end();
        }
    },

    "stop": function(args, msg, serverQueue) {
        if (!serverQueue) {
            msg.channel.send("There isn't anything playing!");
        } else {
            serverQueue.songs = [];
            serverQueue.connection.dispatcher.end('Stop command');
            msg.channel.send("Quit playing all songs");
        }
    },

    "volume": function(args, msg, serverQueue) {
        if (!serverQueue) {
            msg.channel.send("Nothing playing!");
        } else if (args.length == 0) {
            msg.channel.send("Current volume: `" + serverQueue.volume + "`");
        } else if (maxVol != null && args[0] > maxVol) {
            msg.channel.send("Cannot increase volume past the limit of `" + maxVol + "`");
        } else {
            serverQueue.volume = args[0];
            serverQueue.connection.dispatcher.setVolumeLogarithmic(serverQueue.volume / 100);
            msg.channel.send("Volume set to `" + serverQueue.volume + "`");
        }
    },

    "np": function(args, msg, serverQueue) {
        if (!serverQueue) {
            msg.channel.send("There isn't anything playing!");
        } else {
            const song = serverQueue.songs[0];
            const time = serverQueue.connection.dispatcher.time;
            msg.channel.send({embed: {
                color: 100500,
                author: {
                    name: client.user.username,
                    icon_url: client.user.avatarURL,
                },
                title: song.title,
                url: song.url,
                description: "Currently playing song",
                thumbnail: { url: song.thumbnail },
                fields: [
                    {
                        name: 'Current Time',
                        value: `\`${Math.floor(time/3600000) <10 ? '0'+Math.floor(time/3600000) : Math.floor(time/3600000)}:${Math.floor(time/60000) <10 ? '0'+Math.floor(time/60000) : Math.floor(time/60000)}:${Math.floor((time%60000)/1000) <10 ? '0'+Math.floor((time%60000)/1000) : Math.floor((time%60000)/1000)}\``,
                        inline: true
                    },
                    {
                        name: 'Length',
                        value: "`" + song.duration + "`",
                        inline: true
                    },
                    {
                        name: 'Requester',
                        value: song.requester,
                        inline: true
                    },
                ]
            }});
        }
    },

    "queue": function(args, msg, serverQueue) {
        if (!serverQueue || serverQueue.songs.length <= 1) {
            msg.channel.send("Nothing in queue!");
        } else {
            var queueMsg = `${serverQueue.songs.length - 1} song(s) in queue!\n`;
            for (let song of serverQueue.songs) {
                queueMsg += "```" + song.title + " | " + song.duration + "```";
            }
            msg.channel.send(queueMsg);
        }
    },

    "say": function(args, msg) {
        msg.delete();
        msg.channel.send(args.join(" "));
    },

    "setstatus": function(args, msg) {
        if (msg.author.id == config.owner) {
            const typestat = args[0];
            const status = args.slice(1).join(" ");
            client.user.setActivity(status, typestat);
        }
    },

    "lockvol": function(args, msg, serverQueue) {
        if (msg.author.id == config.owner) {
            const newVol = Number(args[0]);
            if (newVol == NaN) {
                if (maxVol == null) {
                    maxVol = 100;
                } else {
                    maxVol = null;
                }
                msg.channel.send("Maximum volume " + (maxVol == null ? "unlocked" : "locked to `100`"));
            } else {
                maxVol = newVol;
                if (serverQueue.volume > maxVol) {
                    serverQueue.connection.dispatcher.setVolumeLogarithmic(maxVol / 100);
                }
                msg.channel.send("Maximum volume locked to `" + maxVol + "`");
            }
        }
    }
};

client.on("message", async msg => {
    if (msg.author.bot || msg.author.id == config.gabo || !msg.content.startsWith(prefix)) {
        return;
    }

    const serverQueue = queue.get(msg.guild.id);
    const command = msg.content.split(" ")[0].substring(prefix.length);
    const args = msg.content.split(" ").slice(1);

    if (commands.hasOwnProperty(command)) {
        commands[command](args, msg, serverQueue);
    }
});

async function queueVid(vid, msg, vc, pl = false) {
    const serverQueue = queue.get(msg.guild.id);

    const song = {
        id: vid.id,
        title: vid.title,
        thumbnail: vid.thumbnails.default.url,
        requester: msg.author.username,
        duration: `${vid.duration.hours <10 ? '0'+vid.duration.hours : vid.duration.hours}:${vid.duration.minutes <10 ? '0'+vid.duration.minutes : vid.duration.minutes}:${vid.duration.seconds <10 ? '0'+vid.duration.seconds : vid.duration.seconds}`,
        url: `https://www.youtube.com/watch?v=${vid.id}`
    };

    if (!serverQueue) {
        const queueConstruct = {
            textChannel: msg.channel,
            voiceChannel: vc,
            connection: null,
            songs: [],
            volume: 100,
            playing: true
        };

        queue.set(msg.guild.id, queueConstruct);
        queueConstruct.songs.push(song);

        try {
            var connection = await vc.join();
            queueConstruct.connection = connection;
            play(msg.guild, queueConstruct.songs[0]);
        } catch(e) {
            console.error(e);
            queue.delete(msg.guild.id);
            msg.channel.send(`Error joining voice channel: ${e.message}`);
        }
    } else {
        serverQueue.songs.push(song);

        if (!pl) {
            msg.channel.send({embed: {
                color: 100500,
                author: {
                    name: client.user.username,
                    icon_url: client.user.avatarURL,
                },
                title: song.title,
                url: song.url,
                description: `Song added to the queue by ${song.requester}`,
                thumbnail: { url: song.thumbnail },
                fields: [
                    {
                        name: 'Duration',
                        value: "`" + song.duration + "`",
                        inline: true
                    },
                    {
                        name: 'Requester',
                        value: song.requester,
                        inline: true
                    }
                ]
            }});
        }
    }
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        queue.delete(guild.id);
        serverQueue.voiceChannel.leave();
        return;
    }

    console.log(serverQueue.songs);

    const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
    .on('end', () => {
        serverQueue.textChannel.send(`**${song.title}** ended!`);
        serverQueue.songs.shift();
        play(guild, serverQueue.songs[0]);
    })
    .on('error', error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 100);

    serverQueue.textChannel.send({embed: {
        color: 100500,
        author: {
            name: client.user.username,
            icon_url: client.user.avatarURL,
        },
        title: song.title,
        url: song.url,
        thumbnail: { url: song.thumbnail },
        fields: [
            {
                name: 'Duration',
                value: "`" + song.duration + "`",
                inline: true
            },
            {
                name: 'Requester',
                value: song.requester,
                inline: true
            }
        ]
    }});
}

client.login(config.token);