// improvedCheck.js - "The Guardian Edition" (Netlify & Telegram Entegrasyonu)

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import TelegramBot from 'node-telegram-bot-api';
import chalk from 'chalk';
import ora from 'ora';

// --- Yapılandırma ---
// YENİ: Durum (state) bin'i için ortam değişkeni eklendi.
const { TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, JSONBIN_API_KEY, JSONBIN_BIN_ID, JSONBIN_STATE_BIN_ID } = process.env;
const bot = TELEGRAM_TOKEN ? new TelegramBot(TELEGRAM_TOKEN) : null;

const config = {
    url: 'https://ais.osym.gov.tr/Sonuc/Listele',
    yksKeyword: 'Yükseköğretim Kurumları Sınavı',
    msuKeyword: 'Millî Savunma Üniversitesi Askerî Öğrenci Aday Belirleme Sınavı',
    loggedInIdentifier: '#anaMenu a[href="/Sonuc/Listele"]',
    errorScreenshotPath: '/tmp/error_screenshot.png',
    resultScreenshotPath: '/tmp/result_screenshot.png',
};

// --- YENİ: DURUM YÖNETİCİSİ (STATE MANAGER) ---
// Sistemin çalışıp çalışmadığını kontrol etmek için. CookieManager'dan ilham alındı.
const stateManager = {
    async read() {
        if (!JSONBIN_API_KEY || !JSONBIN_STATE_BIN_ID) {
            console.warn(chalk.yellow('Durum deposu (JSONBin STATE_BIN_ID) yapılandırılmamış. Varsayılan olarak "ÇALIŞIYOR" kabul ediliyor.'));
            return { status: 'RUNNING' };
        }
        try {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_STATE_BIN_ID}/latest`, {
                method: 'GET',
                headers: { 'X-Master-Key': JSONBIN_API_KEY }
            });
            if (!response.ok) throw new Error(`JSONBin API (durum okuma) hatası: ${response.statusText}`);
            const data = await response.json();
            // Eğer bin boşsa veya status alanı yoksa, varsayılan olarak çalışsın.
            return data.record && data.record.status ? data.record : { status: 'RUNNING' };
        } catch (error) {
            console.error(chalk.red.bold('❌ Durum JSONBin\'den okunamadı, varsayılan olarak "ÇALIŞIYOR" kabul ediliyor:'), error.message);
            return { status: 'RUNNING' };
        }
    },
    // Not: Durum yazma işlemi telegram-webhook fonksiyonu tarafından yapılacak.
    // Bu ana fonksiyonda sadece okuma yapıyoruz.
};


// --- MEVCUT FONKSİYONLAR (HİÇBİR DEĞİŞİKLİK YOK) ---

async function sendTelegramNotification(title, message, options = {}) {
    // ... Bu fonksiyonun içi tamamen aynı ...
    const { imagePath } = options;
    const fullMessage = `*${title}*\n\n${message}`;

    if (!bot || !TELEGRAM_CHAT_ID) {
        console.log(chalk.yellow('Telegram bilgileri eksik, bildirim atlanıyor.'));
        return;
    }

    console.log(chalk.cyan(`📬 Telegram Bildirimi Gönderiliyor: "${title}"`));
    try {
        if (imagePath) {
            await bot.sendPhoto(TELEGRAM_CHAT_ID, imagePath, { caption: fullMessage, parse_mode: 'Markdown' });
        } else {
            await bot.sendMessage(TELEGRAM_CHAT_ID, fullMessage, { parse_mode: 'Markdown' });
        }
    } catch (error) {
        console.error(chalk.red.bold('❌ Telegram bildirimi gönderilemedi:'), error.message);
    }
}

const cookieManager = {
    // ... Bu obje ve içindeki tüm fonksiyonlar tamamen aynı ...
    async read() {
        if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) {
            console.error(chalk.red.bold('❌ JSONBin ortam değişkenleri (API_KEY, BIN_ID) eksik!'));
            return [];
        }
        try {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
                method: 'GET',
                headers: { 'X-Master-Key': JSONBIN_API_KEY }
            });
            if (!response.ok) throw new Error(`JSONBin API hatası: ${response.statusText}`);
            const data = await response.json();
            return data.record || [];
        } catch (error) {
            console.error(chalk.red.bold('❌ Cookie\'ler JSONBin\'den okunamadı:'), error.message);
            return [];
        }
    },
    async write(cookies) {
         if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) {
            console.error(chalk.red.bold('❌ JSONBin ortam değişkenleri (API_KEY, BIN_ID) eksik!'));
            return false;
        }
        try {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY },
                body: JSON.stringify(cookies)
            });
             if (!response.ok) throw new Error(`JSONBin API hatası: ${response.statusText}`);
            return true;
        } catch (error) {
            console.error(chalk.red.bold('❌ Güncel cookie\'ler JSONBin\'e yazılamadı:'), error.message);
            return false;
        }
    },
    async syncFromPage(page) {
        const spinner = ora('Oturum senkronize ediliyor (JSONBin.io)...').start();
        try {
            const currentCookies = await page.cookies();
            if (currentCookies.length > 0) {
                await this.write(currentCookies);
                spinner.succeed(chalk.blueBright('Oturum başarıyla senkronize edildi ve JSONBin.io üzerinde güncellendi.'));
            } else {
                spinner.warn('Senkronize edilecek cookie bulunamadı.');
            }
        } catch (error) {
            spinner.fail('Oturum senkronizasyonu sırasında hata: ' + error.message);
        }
    }
};

async function findAndShowResult(page, keyword) {
    // ... Bu fonksiyonun içi tamamen aynı ...
    const spinner = ora(`'${keyword.substring(0, 20)}...' sonucu görüntüleniyor...`).start();
    try {
        const newPagePromise = new Promise(x => page.browser().once('targetcreated', target => x(target.page())));
        const clicked = await page.evaluate((keywordToFind) => {
            const rows = document.querySelectorAll('.sinav-surec tbody tr');
            for (const row of rows) {
                if (row.innerText.includes(keywordToFind)) {
                    const viewLink = row.querySelector('td a');
                    if (viewLink) { viewLink.click(); return true; }
                }
            }
            return false;
        }, keyword);

        if (!clicked) {
            const message = `'${keyword}' için 'Görüntüle' linki bulunamadı.`;
            spinner.fail(chalk.red(message));
            await sendTelegramNotification('⚠️ Sonuç Görüntüleme Hatası', message);
            return;
        }
        
        spinner.succeed(chalk.green(`'Görüntüle' linki tıklandı. Yeni sekme bekleniyor...`));
        const resultPage = await newPagePromise;
        if(!resultPage) {
            spinner.fail(chalk.red('Sonuç sayfası açılamadı.'));
            await sendTelegramNotification('⚠️ Sonuç Görüntüleme Hatası', 'Tıklama sonrası yeni sonuç sekmesi açılamadı.');
            return;
        }
        
        await resultPage.waitForNetworkIdle({ timeout: 20000 });
        await resultPage.screenshot({ path: config.resultScreenshotPath, fullPage: true });
        console.log(chalk.green.bold(`✅ Sonuç ekran görüntüsü kaydedildi: ${config.resultScreenshotPath}`));
        
        await sendTelegramNotification(
            `🎉 SONUÇ BULUNDU: ${keyword}`,
            'Sonuç detayları ekteki ekran görüntüsündedir.',
            { imagePath: config.resultScreenshotPath }
        );
        
        await resultPage.close();
    } catch (error) {
        const message = 'Sonuç görüntülenirken bir hata oluştu: ' + error.message;
        spinner.fail(chalk.red(message));
        await sendTelegramNotification('🔥 Kritik Hata: Sonuç Görüntüleme', message);
    }
}


// --- NETLIFY HANDLER: Ana fonksiyonumuz (İÇİNE KÜÇÜK BİR KONTROL EKLENDİ) ---
export const handler = async () => {
  // --- YENİ KONTROL BLOĞU ---
  // Fonksiyonun en başında, sistemin durumunu kontrol et.
  const currentState = await stateManager.read();
  if (currentState.status === 'PAUSED') {
      const message = 'Sistem duraklatılmış. Kontrol atlanıyor.';
      console.log(chalk.yellow(`[${new Date().toLocaleString('tr-TR')}] ⏸️  ${message}`));
      // Fonksiyonu burada sonlandırarak token/süre harcamasını engelle.
      return {
          statusCode: 200,
          body: message,
      };
  }
  // --- KONTROL BLOĞU SONU ---

  // Kontrol bloğu geçilirse, mevcut kodunuz eskisi gibi çalışmaya devam eder.
  const checkSpinner = ora(chalk.blue(`[${new Date().toLocaleString('tr-TR')}] 🔍 Kontrol döngüsü başlıyor...`)).start();
  let browser = null;
  let statusMessage = 'Bilinmeyen durum.';

  try {
    const puppeteerOptions = {
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
    };

    const initialCookies = await cookieManager.read();
    if (!initialCookies || initialCookies.length === 0) {
        checkSpinner.fail('Cookie deposu (JSONBin.io) boş veya okunamadı.');
        await sendTelegramNotification('ÖSYM Takipçi Başlatma Hatası', 'Cookie deposu boş veya okunamadı. Lütfen JSONBin.io üzerindeki deponuzu ve Netlify ortam değişkenlerini kontrol edin.');
        return { statusCode: 500, body: 'Cookie deposu boş.' };
    }

    browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();
    await page.setCookie(...initialCookies);
    
    let success = false;
    for (let i = 0; i < 3; i++) {
        try {
            checkSpinner.text = `Sayfaya gidiliyor... (Deneme ${i + 1}/3)`;
            await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 45000 });
            success = true;
            break; 
        } catch (error) {
            checkSpinner.warn(chalk.yellow(`Sayfa yüklenemedi. 5 saniye sonra tekrar denenecek... Hata: ${error.message}`));
            if (i < 2) await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    if (!success) {
        const message = 'Sayfa 3 denemede de yüklenemedi. Ağ bağlantısı veya ÖSYM tarafında bir sorun olabilir.';
        checkSpinner.fail(chalk.red(message));
        await sendTelegramNotification('Ağ Hatası', message);
        return { statusCode: 502, body: message };
    }

    checkSpinner.succeed('Sayfa başarıyla yüklendi.');

    try {
        await page.waitForSelector(config.loggedInIdentifier, { timeout: 20000 });
        console.log(chalk.green('✅ Oturum geçerli.'));
        await cookieManager.syncFromPage(page);
    } catch (e) {
        statusMessage = 'Oturum sonlandı.';
        console.warn(chalk.yellow.bold('🔒 Oturum geçersiz veya süresi dolmuş!'));
        await page.screenshot({ path: config.errorScreenshotPath, fullPage: true });
        await sendTelegramNotification('ÖSYM Oturumu Sonlandı', 'Lütfen cookie dosyanızı güncelleyin. Oturumun neden sonlandığını görmek için ekran görüntüsü eklendi.', { imagePath: config.errorScreenshotPath });
        return { statusCode: 200, body: statusMessage };
    }
    
    const bodyText = await page.evaluate(() => document.body.innerText);

    if (bodyText.includes(config.yksKeyword)) {
      statusMessage = 'YKS SONUCU BULUNDU!';
      console.log(chalk.green.bold.bgWhite('🎉🎉🎉 YKS SONUCU YAYINLANDI! 🎉🎉🎉'));
      await findAndShowResult(page, config.yksKeyword);
    } 
    else if (bodyText.includes(config.msuKeyword)) {
      statusMessage = 'MSÜ SONUCU BULUNDU!';
      console.log(chalk.cyan.bold.bgWhite('🎉 MSÜ SONUCU YAYINLANDI! 🎉'));
      await findAndShowResult(page, config.msuKeyword);
    } 
    else {
      statusMessage = 'Beklenen sonuç bulunamadı.';
      console.log(chalk.magenta('🤔 Beklenen sınav sonuçları bulunamadı.'));
    }

    console.log(chalk.gray(`... Kontrol döngüsü tamamlandı. Durum: ${statusMessage}`));
    return { statusCode: 200, body: statusMessage };

  } catch (err) {
    statusMessage = 'Kritik bir hata oluştu.';
    checkSpinner.fail(chalk.red('❌ Kontrol sırasında kritik bir hata oluştu: ' + err.stack));
    await sendTelegramNotification('🔥 Script Hatası', 'Kritik bir hata oluştu. Detaylar için Netlify fonksiyon loglarını kontrol edin.\n\n`' + err.message + '`');
    return { statusCode: 500, body: `${statusMessage}: ${err.message}` };
  } finally {
    if (browser) await browser.close();
  }
};