const TelegramBot = require('node-telegram-bot-api');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');

// ==========================================
// التوكن والآي دي بتوعك (كما طلبت)
// ==========================================
const TELEGRAM_TOKEN = '9101097487:AAGk3hazm5rZriupzH2FvHbTJMnA0u233Ic';
const ADMIN_ID = 9148219675; 

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

let waSocket = null;
let isConnected = false;
let waitingFor = null;
let targetPhone = null;

// ==========================================
// القوائم والأزرار
// ==========================================
function getMainMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔗 ربط الواتساب بكود", callback_data: "menu_link" }],
                [{ text: "🚀 تشغيل الكراش", callback_data: "menu_crash" }],
                [{ text: "📊 حالة النظام", callback_data: "menu_status" }]
            ]
        }
    };
}

function getAdminMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "👑 لوحة الأدمن", callback_data: "admin_panel" }],
                [{ text: "🛑 إيقاف الكراش", callback_data: "admin_stop" }],
                [{ text: "🔙 رجوع", callback_data: "back_main" }]
            ]
        }
    };
}

// ==========================================
// دالة الربط بالواتساب
// ==========================================
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
            bot.sendMessage(chatId, '✅ تم ربط الواتساب بنجاح! البوت جاهز.', getAdminMenu());
        } else if (update.connection === 'close') {
            isConnected = false;
        }
    });
}

// ==========================================
// أوامر التليجرام النصية
// ==========================================
bot.onText(/\/start/, (msg) => {
    if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, "غير مصرح لك بالدخول.");
    
    bot.sendMessage(msg.chat.id, '👑 *أهلاً بك يا بوس.*\nاختر من لوحة التحكم:', {
        parse_mode: 'Markdown',
        ...getMainMenu()
    });
});

// ==========================================
// استقبال ضغطات الأزرار
// ==========================================
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    if (query.from.id !== ADMIN_ID) {
        return bot.answerCallbackQuery(query.id, { text: "غير مصرح.", show_alert: true });
    }

    if (data === "menu_link") {
        bot.answerCallbackQuery(query.id, { text: "أدخل الرقم الآن.", show_alert: true });
        waitingFor = 'link';
        bot.editMessageText('📱 *أرسل رقم واتسابك الآن (بدون + أو 00):*', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        });
    }
    else if (data === "menu_crash") {
        if (!isConnected) {
            return bot.answerCallbackQuery(query.id, { text: "❌ لازم تربط الواتساب الأول!", show_alert: true });
        }
        bot.answerCallbackQuery(query.id, { text: "أدخل الرقم الآن.", show_alert: true });
        waitingFor = 'crash';
        bot.editMessageText('🎯 *أرسل رقم الضحية (بدون + أو 00):*', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        });
    }
    else if (data === "menu_status") {
        const status = isConnected ? "✅ الواتساب متصل" : "❌ الواتساب غير متصل";
        bot.answerCallbackQuery(query.id, { text: status, show_alert: true });
    }
    else if (data === "admin_panel") {
        bot.answerCallbackQuery(query.id, { text: "لوحة التحكم" });
        bot.editMessageText('👑 *لوحة الأدمن:*', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            ...getAdminMenu()
        });
    }
    else if (data === "admin_stop") {
        bot.answerCallbackQuery(query.id, { text: "تم إيقاف العمليات" });
        bot.editMessageText('🛑 *تم إيقاف العمليات.*', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            ...getMainMenu()
        });
    }
    else if (data === "back_main") {
        bot.answerCallbackQuery(query.id, { text: "رجوع" });
        bot.editMessageText('👑 *لوحة التحكم الرئيسية:*', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            ...getMainMenu()
        });
    }
});

// ==========================================
// استقبال الرسائل (الرقم اللي هيتبعت)
// ==========================================
bot.on('message', async (msg) => {
    if (msg.from.id !== ADMIN_ID) return;
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : '';

    if (waitingFor === 'link' && text && !text.startsWith('/')) {
        waitingFor = null;
        await linkWhatsApp(text, chatId);
    }

    else if (waitingFor === 'crash' && text && !text.startsWith('/')) {
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
        bot.sendMessage(chatId, `✅ تم إرسال ${count} طلب اتصال.`, getMainMenu());
    }
});

console.log('Bot is running with Interactive UI...');
