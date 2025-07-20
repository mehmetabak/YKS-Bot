// telegram-webhook.js - /basla ve /araver komutlarını yönetir

import TelegramBot from 'node-telegram-bot-api';
import chalk from 'chalk';

// Gerekli ortam değişkenlerini al
const { TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, JSONBIN_API_KEY, JSONBIN_STATE_BIN_ID } = process.env;
const bot = TELEGRAM_TOKEN ? new TelegramBot(TELEGRAM_TOKEN) : null;

// Durum yazma işlemini yapacak olan mini State Manager
const stateManager = {
    async write(state) {
        if (!JSONBIN_API_KEY || !JSONBIN_STATE_BIN_ID) {
            console.error(chalk.red.bold('❌ JSONBin durum deposu (STATE_BIN_ID) için ortam değişkenleri eksik!'));
            return false;
        }
        try {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_STATE_BIN_ID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY },
                // JSONBin'e sadece durumu içeren bir obje yazıyoruz
                body: JSON.stringify({ status: state })
            });
            if (!response.ok) throw new Error(`JSONBin API (durum yazma) hatası: ${response.statusText}`);
            return true;
        } catch (error) {
            console.error(chalk.red.bold('❌ Güncel durum JSONBin\'e yazılamadı:'), error.message);
            return false;
        }
    }
};

export const handler = async (event) => {
    // Bot veya gerekli ID'ler yoksa hemen çık
    if (!bot || !TELEGRAM_CHAT_ID || !JSONBIN_STATE_BIN_ID) {
        console.error("Telegram veya JSONBin yapılandırması eksik.");
        return { statusCode: 500, body: "Sunucu tarafında yapılandırma hatası." };
    }

    try {
        const body = JSON.parse(event.body);
        const { message } = body;

        // Mesaj var mı ve doğru kişiden mi geliyor kontrol et
        if (!message || message.chat.id.toString() !== TELEGRAM_CHAT_ID) {
            console.warn(`Yetkisiz erişim denemesi: Chat ID ${message?.chat?.id}`);
            return { statusCode: 403, body: 'Forbidden' };
        }

        const command = message.text;
        let responseMessage = `Anlaşılmayan komut: "${command}"`;
        let success = false;

        if (command === '/araver') {
            console.log('▶️ /araver komutu alındı. Sistem duraklatılıyor...');
            success = await stateManager.write('PAUSED');
            responseMessage = success
                ? '⏸️ Sistem başarıyla duraklatıldı. Kontroller bir sonraki /basla komutuna kadar yapılmayacak.'
                : '❌ Sistem duraklatılırken bir hata oluştu. Lütfen logları kontrol edin.';
        } else if (command === '/basla') {
            console.log('▶️ /basla komutu alındı. Sistem başlatılıyor...');
            success = await stateManager.write('RUNNING');
            responseMessage = success
                ? '✅ Sistem yeniden başlatıldı. Kontroller zamanlandığı gibi devam edecek.'
                : '❌ Sistem başlatılırken bir hata oluştu. Lütfen logları kontrol edin.';
        }
        
        // Kullanıcıya geri bildirim gönder
        await bot.sendMessage(TELEGRAM_CHAT_ID, responseMessage);

        // Telegram'a işlemin başarılı olduğunu bildir
        return { statusCode: 200, body: 'OK' };

    } catch (error) {
        console.error('Webhook işlenirken hata:', error);
        // Hata durumunda bile Telegram'a 200 dönmek, tekrar denemeleri engeller.
        // Asıl hatayı loglardan takip ederiz.
        return { statusCode: 200, body: 'Error processing webhook' };
    }
};