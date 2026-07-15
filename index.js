const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
require('dotenv').config();
let systemEnabled=true;

const invites = new Map(); 
const userPoints = new Map(); 
const inviteLogChannelId = '1526914762028617858'; // ايدي روم تسجيل دخول الاعضاء للسيرفر
const prizeLogChannelId = '1526914762028617858'; // ايدي روم لوق لما احد يفوز ب جائزه يرسل فيه

client.once('ready', async () => {
    console.log(`${client.user.tag} جاهز!`);
    const guild = client.guilds.cache.first();
    if (!guild) return console.log('البوت مب داخل اي سيرفر');

    const guildInvites = await guild.invites.fetch();
    guildInvites.forEach(invite => {
        invites.set(invite.code, invite.uses || 0); // حفظ الدعوات الحالية
    });

    console.log('تم حفظ الدعوات الحالية.');
const ch=guild.channels.cache.get(prizeLogChannelId); if(ch) ch.send('🟢 تم تشغيل بوت عجلة الحظ بنجاح.');
});

// عند دخول عضو جديد
client.on('guildMemberAdd', async member => {
    const guild = member.guild;
    const newInvites = await guild.invites.fetch();
    const oldInvites = invites;

    const usedInvite = newInvites.find(invite => {
        const oldUses = oldInvites.get(invite.code) || 0;
        return invite.uses > oldUses;
    });

    const channel = guild.channels.cache.get(inviteLogChannelId);
    if (usedInvite) {
        const inviter = usedInvite.inviter;
        const currentPoints = userPoints.get(inviter.id) || 0;

        if (!member.user.bot && inviter) {
            if (userPoints.has(member.id)) {
                if (channel) {
                    channel.send(`مرحبًا <@${inviter.id}>! هذا العضو <@${member.id}> تمت دعوته من قبل، لن تحصل على نقاط إضافية ☹️`);
                }
            } else {
                userPoints.set(inviter.id, currentPoints + 1); // تحديث النقاط
                userPoints.set(member.id, 0); // لمنع تكرار الحساب
                if (channel) {
                    channel.send(`مرحبًا <@${inviter.id}>! لقد دعوت <@${member.id}> إلى السيرفر. نقاطك الآن: ${currentPoints + 1} 🔥`);
                }
            }
        }
    }

    newInvites.forEach(invite => {
        invites.set(invite.code, invite.uses || 0);
    });
});


client.on('messageCreate', async message => {
    if (message.content.startsWith('+add-points')) {
        if (!message.member.permissions.has('ManageGuild')) return message.reply('❌ ليس لديك صلاحية استخدام هذا الأمر.');

        const args = message.content.split(' ');
        const member = message.mentions.members.first();
        const pointsToAdd = parseInt(args[2], 10);

        if (!member || isNaN(pointsToAdd)) return message.reply('❌ صيغة الأمر غير صحيحة. استخدم: `+add-points @mentionUser عدد_النقاط`');

        const currentPoints = userPoints.get(member.id) || 0;
        userPoints.set(member.id, currentPoints + pointsToAdd);

        message.reply(`✅ تم إضافة ${pointsToAdd} نقطة لـ <@${member.id}>. النقاط الحالية: ${currentPoints + pointsToAdd}`);
    }

    if (message.content.startsWith('+points')) {
        const member = message.mentions.members.first() || message.member;
        const currentPoints = userPoints.get(member.id) || 0;

        message.reply(`📊 نقاط <@${member.id}>: ${currentPoints}`);
    }

    if(message.content==='+off'){if(!message.member.permissions.has('Administrator')) return message.reply('❌'); systemEnabled=false; return message.reply('✅ تم إيقاف النظام');}
if(message.content==='+start'){if(!message.member.permissions.has('Administrator')) return message.reply('❌'); systemEnabled=true; return message.reply('✅ تم تشغيل النظام');}
if (message.content === '+spin') {
if(!systemEnabled) return message.reply('⛔ النظام متوقف حالياً.');
        const userPointsCount = userPoints.get(message.author.id) || 0;

        if (userPointsCount < 1) return message.reply('❌ تحتاج على الأقل إلى 1 دعوة لاستخدام عجلة الحظ العادية!');

        const embed = new EmbedBuilder()
            .setTitle('🎉 لعبة عجلة الحظ 🎉')
            .setDescription('اختر نوع العجلة التي تريد اللعب بها:')
            .addFields(
                { name: '🎡 عجلة الحظ العادية', value: 'يتطلب 1 نقطة' },
                { name: '🔥 عجلة الحظ السوبر', value: 'يتطلب 2 نقاط' }
            )
            .setColor('Blue');

        const row = {
            type: 1,
            components: [
                {
                    type: 2,
                    label: 'لف العجلة العادية',
                    style: 1,
                    custom_id: 'normal_spin'
                },
                {
                    type: 2,
                    label: 'لف العجلة السوبر',
                    style: 4,
                    custom_id: 'super_spin'
                }
            ]
        };

        await message.reply({ embeds: [embed], components: [row] });
    }
});

// معالجة الأزرار وعجلة الحظ
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
if(!systemEnabled) return interaction.reply({content:'⛔ النظام متوقف حالياً.',ephemeral:true});

    const userPointsCount = userPoints.get(interaction.user.id) || 0;
    const prizeChannel = interaction.guild.channels.cache.get(prizeLogChannelId);

    if (interaction.customId === 'normal_spin') {
        if (userPointsCount < 1) return interaction.reply('❌ ليس لديك نقاط كافية.');

        userPoints.set(interaction.user.id, userPointsCount - 1); // خصم النقاط
        const prize = getRandomPrize('normal');

        if (prizeChannel) {
            prizeChannel.send(`> 🥳 مبروك <@${interaction.user.id}>! لقد فزت بـ **${prize}** 🏆`);
        }

        interaction.reply(`🎉 مبروك <@${interaction.user.id}>! لقد فزت بـ **${prize}**! 🏆`);
    } else if (interaction.customId === 'super_spin') {
        if (userPointsCount < 2) return interaction.reply('❌ ليس لديك نقاط كافية.');

        userPoints.set(interaction.user.id, userPointsCount - 2); // خصم النقاط
        const prize = getRandomPrize('super');

        if (prizeChannel) {
            prizeChannel.send(`> 🥳 مبروك <@${interaction.user.id}>! لقد فزت بـ **${prize}** 🏆`);
        }

        interaction.reply(`🎉 مبروك <@${interaction.user.id}>! لقد فزت بـ **${prize}**! 🏆`);
    }
});

// الجوائز ونسب الفوز
const prizes = {
    normal: [
        { prize: '200k', chance: 0.9 },    //0.9 = 9%
        { prize: '400k', chance: 0.8 },  //0.8 = 8%
        { prize: '900k', chance: 0.7 },  //0.7 = 7%
        { prize: '1M', chance: 0.7 },      //0.1= 7%
        { prize: '2M', chance: 0.5 },      //0.1 = 5%
        { prize: '3M', chance: 0.3 },      //0.1 = 3%
        { prize: '15M', chance: 0.2 },     //0.1 = 2%
        { prize: 'Nitro Classic', chance: 0.00005 }
    ],
    super: [
        { prize: '400k', chance: 0.10 }, //0.10 = 10%
        { prize: '500k', chance: 0.8 },  //0.8 = 8%
        { prize: '1M', chance: 0.3 },      //0.3 = 3%
        { prize: '2M', chance: 0.3 },      //0.3 = 3%
        { prize: '3M', chance: 0.4 },      //0.4 = 4%
        { prize: '5M', chance: 0.5 },      //0.5 = 5%
        { prize: '10M', chance: 0.2 },      //0.2 = 2%
        { prize: '25M', chance: 0.001},
        { prize: 'Nitro Gaming', chance: 0.00005 }
    ]
};

function getRandomPrize(type) {
    const random = Math.random();
    let cumulativeChance = 0;

    for (const item of prizes[type]) {
        cumulativeChance += item.chance;
        if (random <= cumulativeChance) {
            return item.prize;
        }
    }
}

client.login(process.env.TOKEN)