# 🤖 ÖSYM Sonuç Takipçisi (Netlify & Telegram ile)

[![Netlify Status](https://api.netlify.com/api/v1/badges/a05ad83a-585a-4989-b265-d3437582dafa/deploy-status)](https://app.netlify.com/projects/yks-bot/deploys)

Bu proje, ÖSYM'nin Aday İşlemleri Sistemi (AİS) üzerinden sınav sonuçlarını (özellikle YKS ve MSÜ) periyodik olarak kontrol eden ve yeni bir sonuç yayınlandığında anında Telegram üzerinden bildirim ve ekran görüntüsü gönderen sunucusuz (serverless) bir bottur.

Proje, Netlify'ın **Zamanlanmış Fonksiyonlar (Scheduled Functions)** altyapısı üzerinde çalışır ve oturum bilgilerini (cookie) harici bir JSON depolama servisi olan **JSONBin.io** üzerinde güvenli bir şekilde saklar.

## ✨ Özellikler

*   **Sunucusuz Mimari:** Netlify üzerinde çalışır, 7/24 açık bir sunucuya ihtiyaç duymaz, maliyeti düşüktür.
*   **Anlık Telegram Bildirimleri:** Yeni bir sonuç (YKS, MSÜ vb.) açıklandığında, sonucun ekran görüntüsüyle birlikte anında Telegram'a mesaj gönderir.
*   **Proaktif Oturum Yönetimi:** Her başarılı kontrolde tarayıcıdaki en güncel oturum bilgilerini (cookie) otomatik olarak günceller ve JSONBin.io'ya kaydeder, böylece oturumun kapanma riskini en aza indirir.
*   **Sağlam Hata Yönetimi:** Ağ hataları, oturumun sonlanması gibi durumlarda kendini tekrar dener ve başarısızlık durumunda yine Telegram üzerinden bilgilendirme yapar.
*   **Kolay Kurulum:** Birkaç adımlık yapılandırma ile hızlıca çalışır hale getirilebilir.

## ⚙️ Kullanılan Teknolojiler

*   **Platform:** [Netlify Functions](https://www.netlify.com/products/functions/)
*   **Otomasyon:** [Puppeteer](https://pptr.dev/) (`@sparticuz/chromium` ile sunucusuz ortama uyumlu)
*   **Veri Depolama:** [JSONBin.io](https://jsonbin.io/) (Oturum cookie'leri için)
*   **Bildirim:** [Telegram Bot API](https://core.telegram.org/bots/api)
*   **Geliştirme:** [Node.js](https://nodejs.org/)

---

## 🔧 Kurulum ve Yapılandırma Kılavuzu

Bu kılavuzu takip ederek projeyi kendi hesabınızda çalışır hale getirebilirsiniz.

### 0. Ön Gereksinimler

*   [Node.js](https://nodejs.org/en/) (v18 veya üstü)
*   [Git](https://git-scm.com/)
*   **GitHub** (veya GitLab/Bitbucket) hesabı
*   **Netlify** hesabı
*   **Telegram** hesabı
*   **JSONBin.io** hesabı

### 1. Projenin Alınması

Öncelikle bu projeyi kendi GitHub hesabınıza `fork`'layın veya `clone`'layın.

```bash
# Projeyi klonla
git clone https://github.com/[SENIN-KULLANICI-ADIN]/[PROJE-ADIN].git

# Proje klasörüne gir
cd [PROJE-ADIN]
```

### 2. Bağımlılıkların Kurulması

Gerekli Node.js paketlerini yükleyin.

```bash
npm install
```

### 3. Telegram Bot Hazırlığı

1.  Telegram'da **@BotFather** ile bir sohbet başlatın.
2.  `/newbot` komutuyla yeni bir bot oluşturun.
3.  BotFather'ın size verdiği **HTTP API Token**'ını kopyalayın. Bu sizin `TELEGRAM_TOKEN`'ınız olacak.
4.  **@userinfobot**'a bir mesaj göndererek **Chat ID**'nizi öğrenin ve kopyalayın. Bu sizin `TELEGRAM_CHAT_ID`'niz olacak.

### 4. Veri Depolama Alanının (JSONBin.io) Hazırlanması

1.  [jsonbin.io](https://jsonbin.io/) sitesinden ücretsiz bir hesap oluşturun.
2.  Giriş yaptıktan sonra, sağ üstteki menüden **API Keys** sayfasına gidin ve `X-Master-Key` değerinizi kopyalayın. Bu sizin `JSONBIN_API_KEY`'iniz olacak.
3.  Ana sayfaya dönüp **"Create Your First Bin"** diyerek yeni bir depolama alanı oluşturun.
4.  Oluşturulan Bin'in adres çubuğundaki ID'sini kopyalayın (`https://jsonbin.io/app/bins/`'den sonraki kısım). Bu sizin `JSONBIN_BIN_ID`'niz olacak.
5.  **En Önemli Adım:** Tarayıcınızdan ÖSYM AİS'e giriş yapın. [Cookie-Editor](https://cookie-editor.com/) gibi bir eklenti kullanarak o anki cookie'lerinizi JSON formatında kopyalayın. JSONBin.io'da oluşturduğunuz Bin'in içine bu JSON verisini yapıştırın ve kaydedin. Bu, script'in ilk çalışması için gereklidir.

### 5. Netlify Projesinin Kurulumu ve Dağıtımı

1.  Netlify panonuza gidin ve "Add new site" -> "Import an existing project" seçeneğini seçin.
2.  GitHub hesabınızı bağlayın ve bu projeyi seçin.
3.  Deploy ayarları genellikle otomatiktir. `netlify.toml` dosyası sayesinde her şey ayarlanmıştır.
4.  Deploy etmeden önce, ortam değişkenlerini ayarlayın: **Site settings > Build & deploy > Environment > Environment variables** bölümüne gidin ve aşağıdaki 4 değişkeni ekleyin:
    *   `TELEGRAM_TOKEN`: (Adım 3'teki token)
    *   `TELEGRAM_CHAT_ID`: (Adım 3'teki ID)
    *   `JSONBIN_API_KEY`: (Adım 4'teki master key)
    *   `JSONBIN_BIN_ID`: (Adım 4'teki bin ID)
5.  **"Deploy site"** butonuna basın.

Deploy işlemi tamamlandıktan sonra, **Functions > check-osym-scheduled** fonksiyonunuza gidip "Invoke function" diyerek manuel olarak test edebilirsiniz. Logları aynı ekrandan takip edebilirsiniz. Her şey yolundaysa, Telegram botunuzdan bir mesaj almalısınız.

## 🚀 Çalışma Prensibi

1.  `netlify.toml` dosyasındaki `schedule` kuralına göre Netlify, `check-osym` fonksiyonunu her 10 dakikada bir tetikler.
2.  Fonksiyon, `JSONBIN_API_KEY` ve `JSONBIN_BIN_ID` kullanarak JSONBin.io'dan en güncel cookie'leri okur.
3.  Puppeteer ve `@sparticuz/chromium` ile sunucusuz bir tarayıcı başlatır.
4.  Okunan cookie'leri tarayıcıya set eder ve ÖSYM Sonuç sayfasına gider.
5.  Oturumun geçerli olup olmadığını kontrol eder.
    *   **Geçerliyse:** Sayfa içeriğinde YKS veya MSÜ anahtar kelimelerini arar. Bulursa `findAndShowResult` fonksiyonunu çağırır. Ardından, en güncel cookie'leri tarayıcıdan alıp tekrar JSONBin.io'ya yazar.
    *   **Geçersizse:** Oturumun sonlandığına dair ekran görüntüsü alır ve Telegram'a bildirim gönderir.
6.  `findAndShowResult` fonksiyonu, sonucun "Görüntüle" linkine tıklar, açılan yeni sayfanın ekran görüntüsünü alır ve bu görüntüyü Telegram'a gönderir.

## 📜 Lisans

Bu proje **MIT Lisansı** altında lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakınız.

Kısacası, bu kodu istediğiniz gibi kullanabilir, değiştirebilir ve dağıtabilirsiniz, ancak tüm sorumluluk size aittir.

## ⚠️ Sorumluluk Reddi

Bu proje yalnızca eğitim ve kişisel kullanım amaçlı geliştirilmiştir. ÖSYM'nin kullanım koşullarını ihlal etmekten kaçının. Projenin kullanımından doğabilecek her türlü sorumluluk kullanıcıya aittir.