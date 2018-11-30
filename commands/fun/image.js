const commando = require('discord.js-commando');

module.exports = class ImageFunction extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'image',
            group: 'fun',
            memberName: 'image',
            description: 'Shows an image from google',
            args: [
                {
                    key: 'search',
                    prompt: 'What do you want to search for?',
                    type: 'string'
                }
            ]
        });
    }

    async run(message,args) {
        message.say("This function is under construction, search for `"+args.search+"` later.");
    }
}