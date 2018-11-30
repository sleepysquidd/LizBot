const commando = require('discord.js-commando');
var stc;
module.exports = class SetStatusCommand extends commando.Command {
    constructor(client) {
        stc = client;
        super(client, {
            name: 'setstatus',
            aliases: ['status','game','playing'],
            group: 'util',
            memberName: 'setstatus',
            description: 'Sets the status of the bot',
            ownerOnly: true,

            args: [
                {
                    key: 'status',
                    prompt: 'What do you want the status to say?',
                    type: 'string'
                },
                {
                    key: 'mode',
                    prompt: 'Type of status message',
                    type: 'string'
                }
            ]
        });
    }
    
    async run(message,{status,mode}) {
        message.say('Set Squidd Bot\'s status as: ' + status);
        stc.user.setActivity(status,{url: 'https://www.twitch.tv/sleepysquidd',type: mode});
    }
}