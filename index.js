const Discord = require('discord.js');
const config = require('./config.json');
const ytdl = require('ytdl-core');
const ytl = require('simple-youtube-api');
const GoogleImages = require('google-images');


const client = new Discord.Client();
const gClient = new GoogleImages('008145624407253320335:4pwvoicqqnc',config.cseapi);
const queue = new Map();
const prefix = config.prefix;
const yt = new ytl(config.ytapi);

var maxVol = null;
const barrow = `◀`;
const farrow = `▶`;

client.on("ready", () => {
    console.log('Starting Liz Bot with '+client.users.size+' users in '+client.channels.size+' channels within '+client.guilds.size+' servers.');
    client.user.setActivity('helping '+client.guilds.size+' servers!');
});

client.on("messageReactionAdd", (reaction, user) => {
    console.log(reaction.message.author);
    console.log("Reaction!");
});


client.on("guildMemberAdd", member => {
    const welcchan = member.guild.channels.find('name', 'member-log');
    if(!welcchan) return;
    console.log(`New member: ${member}`);
    welcchan.send({embed: {
        color: 3066993,
        author: {
            name: member.user.username,
            icon_url: member.user.avatarURL,
        },
        title: "Member joined!",
        description: member.user.tag+" joined the server!",
        timestamp: new Date()
    }});
});

client.on("guildMemberRemove", member => {
    const welcchan = member.guild.channels.find('name', 'member-log');
    if(!welcchan) return;
    console.log(`Lost member: ${member}`);
    welcchan.send({embed: {
        color: 3066993,
        author: {
            name: member.user.username,
            icon_url: member.user.avatarURL,
        },
        title: "Member left!",
        description: member.user.tag+" left the server!",
        timestamp: new Date()
    }});
});

client.on("messageDelete", async msg => {
    msg.channel.send(`${msg.author.username} deleted message: ${msg.content}`);
});

client.on("guildCreate", guild => {
    console.log('Added to new server: '+guild.name+' (id:'+guild.id+'). Total members: '+guild.memberCount+'.');
    client.user.setActivity('helping '+client.guilds.size+' servers!');
    client.users.get(config.owner).sendMessage('Added to new server: '+guild.name+' (id:'+guild.id+'). Total members: '+guild.memberCount+'. Owner: '+guild.owner+'.');
});

client.on("guildDelete", guild => {
    console.log('Removed from server: '+guild.name+' (id:'+guild.id+'). Total members: '+guild.memberCount+'.');
    client.user.setActivity('helping '+client.guilds.size+' servers!');
    client.users.get(config.owner).sendMessage('Removed from server: '+guild.name+' (id:'+guild.id+'). Total members: '+guild.memberCount+'. Owner: '+guild.owner+'.');
});

client.on("message", async msg => {
    if(msg.author.bot || msg.author.id == config.gabo) return;
    if(!msg.content.startsWith(prefix)) return;
    const serverQueue = queue.get(msg.guild.id);
    const args = msg.content.split(" ");

    if(msg.content.startsWith(`${prefix}image`)) {
        if(args.length==1) return;
        const searchString = args.slice(1).join(' ');
        var imgs = await gClient.search(searchString);
        var i;

        /*
        for(i=1;i<5;i++) {
            var results = await gClient.search(searchString, {page: i});
            console.log(i);
            imgs = imgs.concat(results);
        }*/

        var sMsg = await msg.channel.send({embed: {
            color: 100500,
            author: {
                name: msg.user.username,
                icon_url: msg.user.avatarURL,
            },
            title: `Search results for \`${searchString}\``,
            image: {
                url: `${imgs[0].url}`
            },
            footer: {
                text: `Total results: ${imgs.length}`
            }
        }});
        //sMsg.react(barrow);
        //sMsg.react(farrow);
        //console.log(sMsg);
    }

    if(msg.content.startsWith(`${prefix}log`)) {
        var surl = args[1].replace(/<(.+)>/g, '$1');
        const pl = await yt.getPlaylist(surl);
        const vids = await pl.getVideos();
        console.log(vids.length);
    }
    if(msg.content.startsWith(`${prefix}play`)) {
        if (args.length==1) return msg.channel.send('Enter a search term or youtube link!');
        const searchString = args.slice(1).join(' ');
        const url = args[1].replace(/<(.+)>/g, '$1');
        const vc = msg.member.voiceChannel;

        if(!vc) return msg.channel.send(`You need to be in a voice channel to queue a song!`);
        const perms = vc.permissionsFor(msg.client.user);
        if(!perms.has('CONNECT')) return msg.channel.send('I am missing the connect permission!');
        if(!perms.has('SPEAK')) return msg.channel.send('I am missing the speak permission!');

        if(url.indexOf(`list`) + 1) {
            const pl = await yt.getPlaylist(url);
            const vids = await pl.getVideos();
            msg.channel.send(`Playlist addded with ${vids.length} songs!`);
            for(i=0;i<vids.length;i++) {
                const vid = await yt.getVideoByID(vids[i].id);
                await queueVid(vid,msg,vc,true);
            }

        } else {
            try {
                var vid = await yt.getVideo(url);
            } catch(error) {
                try {
                    var vidSearch = await yt.searchVideos(searchString, 1);
                    var vid = await yt.getVideoByID(vidSearch[0].id);
                } catch(error) {
                    return msg.channel.send(`Couldn't find \`${args}\``);
                }
            }
            return queueVid(vid,msg,vc);
        }
        return;
    } else if(msg.content.startsWith(`${prefix}skip`)) {
        if(!msg.member.voiceChannel) return msg.channel.send(`You aren't in a voice channel!`);
        if(!serverQueue) return msg.channel.send(`There is nothing to skip!`);
        serverQueue.connection.dispatcher.end();
        return;
    } else if (msg.content.startsWith(`${prefix}stop`)) {
        if(!serverQueue) return msg.channel.send(`There isn't anything playing!`);
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end('Stop command');
        return msg.channel.send(`Quit playing all songs`);
    } else if (msg.content.startsWith(`${prefix}volume`)) {
        if(!serverQueue) return msg.channel.send(`Nothing playing!`);
        if(!args[1]) return msg.channel.send(`Current volume: \`${serverQueue.volume}%\``);
        serverQueue.volume = args[1];
        if(maxVol!=null&&args[1]>maxVol) return msg.channel.send(`Cannot increase volume past the limit of \`${maxVol}\``);
        serverQueue.connection.dispatcher.setVolumeLogarithmic(serverQueue.volume/100);
        return msg.channel.send(`Volume set to \`${serverQueue.volume}%\``);
    } else if (msg.content.startsWith(`${prefix}np`)) {
        if(!serverQueue) return msg.channel.send(`There isn't anything playing!`);
        const song = serverQueue.songs[0];
        const time = serverQueue.connection.dispatcher.time;
        return msg.channel.send({embed: {
            color: 100500,
            author: {
                name: client.user.username,
                icon_url: client.user.avatarURL,
            },
            title: song.title,
            url: song.url,
            description: `Currently playing song`,
            thumbnail: {
                url: song.thumbnail
            },
            fields: [
                {
                    name: 'Length',
                    value: `\`${song.duration}\``,
                    inline: true
                },
                {
                    name: 'Requester',
                    value: `\`${song.requester}\``,
                    inline: true
                },
                {
                    name: 'Current Time',
                    value: `\`${Math.floor(time/3600000) <10 ? '0'+Math.floor(time/3600000) : Math.floor(time/3600000)}:${Math.floor(time/60000) <10 ? '0'+Math.floor(time/60000) : Math.floor(time/60000)}:${Math.floor((time%60000)/1000) <10 ? '0'+Math.floor((time%60000)/1000) : Math.floor((time%60000)/1000)}\``,
                    inline: true
                }
            ]
        }});
    } else if (msg.content.startsWith(`${prefix}queue`)) {
        if(serverQueue.songs.length<=1) return msg.channel.send(`Nothing in queue!`);
        var queueMsg = `${serverQueue.songs.length-1} song(s) in queue!\n\`\`\``;
        for(var i=1;i<serverQueue.songs.length;i++) {
            queueMsg+=`${serverQueue.songs[i].title} | (${serverQueue.songs[i].duration})\n`;
        }
        queueMsg+=`\`\`\`\n`;
        return msg.channel.send(queueMsg);
    } 

    if (msg.content.startsWith(`${prefix}say`)) {
        msg.delete();
        msg.channel.send(args.slice(1).join(" "));
    }

    if (msg.content.startsWith(`${prefix}setstatus`)) {
        if (msg.author.id!=config.owner) return;
        const typestat = args.slice(1,2);
        const status = args.slice(2).join(" ");
        client.user.setActivity(String(status),{type: String(typestat)});
    }

    if (msg.content.startsWith(`${prefix}lockvol`)) {
        if(msg.author.id!=config.owner) return;
        const newVol = Number(args.slice(1));
        if(!newVol) {
            if(maxVol==null) maxVol=100;
            else maxVol = null;
            return msg.channel.send(`Volume ${maxVol==null ? 'unlocked': 'locked to \`100\`'}`);
        }

        maxVol = newVol;
        if(serverQueue.volume>maxVol) serverQueue.songs[0].connection.dispatcher.setVolumeLogarithmic(maxVol/100);
        return msg.channel.send(`Volume locked to \`${maxVol}\``);
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
    if(!serverQueue) {
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
        } catch(error) {
            console.error(error);
            queue.delete(msg.guild.id);
            return msg.channel.send(`Error joining voice channel: ${error}`);
        }
    } else {
        serverQueue.songs.push(song);
        if(!pl) {
            msg.channel.send({embed: {
                color: 100500,
                author: {
                    name: client.user.username,
                    icon_url: client.user.avatarURL,
                },
                title: song.title,
                url: song.url,
                description: `Song added to the queue by ${song.requester}`,
                thumbnail: {
                    url: song.thumbnail
                },
                fields: [
                    {
                    name: 'Duration',
                    value: `\`${song.duration}\``,
                    inline: true
                    },
                    {
                    name: 'Requester',
                    value: `\`${song.requester}\``,
                    inline: true
                    }
                ]
            }});
        }
    }
    return;
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    
    if(!song) {
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
    dispatcher.setVolumeLogarithmic(serverQueue.volume/100);

    serverQueue.textChannel.send({embed: {
        color: 100500,
        author: {
            name: client.user.username,
            icon_url: client.user.avatarURL,
        },
        title: song.title,
        url: song.url,
        thumbnail: {
            url: song.thumbnail
        },
        fields: [
            {
            name: 'Duration',
            value: `\`${song.duration}\``,
            inline: true
            },
            {
            name: 'Requester',
            value: `\`${song.requester}\``,
            inline: true
            }
        ]
    }});
}

client.login(config.token);