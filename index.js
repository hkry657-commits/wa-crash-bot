const http = require('http');
const TelegramBot = require('node-telegram-bot-api');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');

// ==========================================
// التوكن والآي دي
// ==========================================
const TELEGRAM_TOKEN = '9101097487:AAGk3hazm5rZriupzH2FvHbTJMnA0u233Ic';
const ADMIN_ID = 9148219675; 

const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
}).listen(PORT, () => {
    console.log(`السيرفر شغال على بورت ${PORT}`);
});

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
let waSocket = null;
let isConnected = false;
let connectedNumber = null;

// ==========================================
// واجهة التلجرام (بالسوداني)
// ==========================================
function getMainMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔗 اربط الواتساب بالكود", callback_data: "menu_link" }],
                [{ text: "📊 حالة الشغل", callback_data: "menu_status" }],
                [{ text: "🛑 وقف البوت", callback_data: "menu_stop" }]
            ]
        }
    };
}

// ==========================================
// دالة الربط بالواتساب
// ==========================================
async function linkWhatsApp(phone, chatId) {
    if (waSocket) { try { waSocket.end(); } catch(e) {} }
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_' + phone);
    
    waSocket = makeWASocket({
        printQRInTerminal: false,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!waSocket.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await waSocket.requestPairingCode(phone);
                bot.sendMessage(chatId, `🔗 *كود الربط بتاعك:*\n\`${code}\`\n\n١. افتح الواتساب.\n٢. الأجهزة المرتبطة.\n٣. اربط جهاز.\n٤. الربط بكود.\n٥. اكتب الكود ده.`, { parse_mode: 'Markdown', ...getMainMenu() });
            } catch (err) {
                bot.sendMessage(chatId, `❌ في مشكلة في جلب الكود: ${err.message}`);
            }
        }, 3000);
    }

    waSocket.ev.on('creds.update', saveCreds);
    waSocket.ev.on('connection.update', (update) => {
        if (update.connection === 'open') {
            isConnected = true;
            connectedNumber = phone;
            bot.sendMessage(chatId, `✅ الواتساب اتصل يا بوس (${phone})!\n\nسيب التلجرام دلوقتي، وروح للواتساب واكتب \`.القائمة\``, { ...getMainMenu() });
        } else if (update.connection === 'close') {
            isConnected = false;
        }
    });

    // ==========================================
    // استقبال الأوامر من الواتساب (بالسوداني)
    // ==========================================
    waSocket.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        const sender = msg.key.remoteJid;

        if (!text) return;

        // قائمة الأوامر
        if (text === '.القائمة' || text === '.menu') {
            const menu = `👑 *بوت الكراش السوداني* 👑\n\n` +
                         `*المستخدم:* ${connectedNumber}\n` +
                         `*المطور:* WOODE\n\n` +
                         `*الأوامر المتاحة:*\n` +
                         `- \`.كراش <رقم>\` : ابدأ الضرب\n` +
                         `- \`.سبام <رقم>\` : ابعت صور وصوت\n` +
                         `- \`.حالة\` : شوف الاتصال`;
            await waSocket.sendMessage(sender, { text: menu });
        }

        // أمر الكراش
        else if (text.startsWith('.كراش ') || text.startsWith('.crash ')) {
            const target = text.split(' ')[1];
            if (!target) return waSocket.sendMessage(sender, { text: '❌ اكتب الرقم بعد الأمر يا بوس.' });
            
            await waSocket.sendMessage(sender, { text: `🚀 بدينا الضرب على الرقم ${target}...` });
            let count = 0;
            for (let i = 0; i < 20; i++) {
                try {
                    await waSocket.sendMessage(target + '@s.whatsapp.net', { text: 'Calling...' });
                    count++;
                } catch (err) {}
                await new Promise(r => setTimeout(r, 1000));
            }
            await waSocket.sendMessage(sender, { text: `✅ خلصنا، دقينا ${count} ضربة.` });
        }

        // أمر السبام
        else if (text.startsWith('.سبام ') || text.startsWith('.spam ')) {
            const target = text.split(' ')[1];
            if (!target) return waSocket.sendMessage(sender, { text: '❌ اكتب الرقم بعد الأمر يا بوس.' });

            await waSocket.sendMessage(sender, { text: `🚀 بدينا السبام على الرقم ${target}...` });
            const imageUrl = 'https://i.ibb.co/6P2yKq5/hacker-bg.jpg';
            const audioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
            
            let count = 0;
            for (let i = 0; i < 10; i++) {
                try {
                    await waSocket.sendMessage(target + '@s.whatsapp.net', { image: { url: imageUrl }, caption: 'CRASH!' });
                    await waSocket.sendMessage(target + '@s.whatsapp.net', { audio: { url: audioUrl }, mimetype: 'audio/mp4' });
                    count++;
                } catch (err) {}
                await new Promise(r => setTimeout(r, 2000));
            }
            await waSocket.sendMessage(sender, { text: `✅ خلصنا، بعتنا ${count} دفعة.` });
        }

        // أمر الحالة
        else if (text === '.حالة' || text === '.status') {
            await waSocket.sendMessage(sender, { text: `✅ متصل بالرقم: ${connectedNumber}` });
        }
    });
}

// ==========================================
// أوامر وضغطات التلجرام
// ==========================================
bot.onText(/\/start/, (msg) => {
    if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, "ما عندك صلاحية يا زول.");
    bot.sendMessage(msg.chat.id, `👑 *بوت الكراش السوداني*\nاختار من القائمة:`, { parse_mode: 'Markdown', ...getMainMenu() });
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    if (query.from.id !== ADMIN_ID) return bot.answerCallbackQuery(query.id, { text: "ما عندك صلاحية", show_alert: true });

    if (data === "menu_link") {
        bot.answerCallbackQuery(query.id, { text: "اكتب الرقم الآن.", show_alert: true });
        bot.sendMessage(chatId, '📱 *اكتب رقم الواتساب بتاعك (مثال: 2499148219675):*', { parse_mode: 'Markdown' });
        bot.once('message', async (msg) => {
            if (msg.from.id !== ADMIN_ID) return;
            await linkWhatsApp(msg.text.trim(), chatId);
        });
    }
    else if (data === "menu_status") {
        const status = isConnected ? `✅ متصل (${connectedNumber})` : "❌ ما متصل";
        bot.answerCallbackQuery(query.id, { text: status, show_alert: true });
    }
    else if (data === "menu_stop") {
        if (waSocket) { try { waSocket.end(); } catch(e) {} }
        isConnected = false;
        bot.answerCallbackQuery(query.id, { text: "تم وقف البوت", show_alert: true });
        bot.editMessageText('🛑 *البوت اتوقف.*', { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown', ...getMainMenu() });
    }
});

console.log('البوت شغال.. كلمني في التلجرام.');
