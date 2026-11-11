// Footer specific translations
const footerTranslations = {
    mn: {
        "foot-links-title": "Хурдан холбоос",
        "foot-about-title": "Бидний тухай",
        "foot-social-title": "Сошиал сувгууд",
        "foot-about": "Танилцуулга",
        "foot-contact": "Холбоо барих",
        "foot-tagline": "Дэлхийн зах зээлийн хөдөлгөөнийг <br> дата шинжилгээгээр түрүүлж мэдэр.",
        "privacy-page-title": "Нууцлалын бодлого",
        "terms-page-title": "Үйлчилгээний нөхцөл",
        "risk-page-title": "Эрсдэлийн анхааруулга",
        "nav-home": "Нүүр", "nav-forex": "Форекс", "nav-crypto": "Крипто", "nav-news": "Мэдээ"
    },
    en: {
        "foot-links-title": "Fast Links",
        "foot-about-title": "About Us",
        "foot-social-title": "Social Links",
        "foot-about": "About",
        "foot-contact": "Contact",
        "foot-tagline": "Experience global market movements <br> with data intelligence.",
        "privacy-page-title": "Privacy Policy",
        "terms-page-title": "Terms of Service",
        "risk-page-title": "Risk Warning",
        "nav-home": "Home", "nav-forex": "Forex", "nav-crypto": "Crypto", "nav-news": "News"
    }
};

// Initialize window.translations if it doesn't exist yet
if (typeof window.translations === 'undefined') window.translations = { mn: {}, en: {} };

// Merge footer translations into the global object
Object.keys(footerTranslations).forEach(lang => {
    window.translations[lang] = { 
        ...footerTranslations[lang], 
        ...window.translations[lang] 
    };
});

const footerHTML = `
<footer class="bg-brand-dark-blue border-t border-brand-border">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
        <div class="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 py-4 md:py-5">
            <div class="col-span-2 md:col-span-1">
                <div class="flex items-center justify-between md:block">
                    <span class="text-lg font-black tracking-tighter text-white md:mb-2">MGL<span class="text-brand-gold font-normal">Signal</span></span>
                    <div class="flex items-center gap-3 text-gray-400">
                        <a href="https://www.facebook.com/share/1Dg7fcoaMu/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" class="hover:text-brand-gold transition text-sm"><i class="fab fa-facebook-f"></i></a>
                        <a href="https://t.me/Crypto_sharing_world" target="_blank" rel="noopener noreferrer" aria-label="Telegram" class="hover:text-brand-gold transition text-sm"><i class="fab fa-telegram-plane"></i></a>
                        <a href="https://www.youtube.com/@mglsignal" target="_blank" rel="noopener noreferrer" aria-label="YouTube" class="hover:text-brand-gold transition text-sm"><i class="fab fa-youtube"></i></a>
                    </div>
                </div>
                <p data-i18n="foot-tagline" class="text-gray-500 text-[11px] leading-relaxed mt-1">
                    Дэлхийн зах зээлийн хөдөлгөөнийг <br> дата шинжилгээгээр түрүүлж мэдэр.
                </p>
            </div>

            <div>
                <h3 data-i18n="foot-links-title" class="text-brand-gold text-[10px] font-bold uppercase tracking-[0.16em] mb-2">Хурдан холбоос</h3>
                <ul class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-medium md:grid-cols-1 md:gap-y-0 md:space-y-1">
                    <li><a href="/index.html" data-i18n="nav-home" class="mgl-spotlight-text text-gray-400 hover:text-white transition">Нүүр</a></li>
                    <li><a href="#" data-i18n="nav-forex" class="mgl-spotlight-text text-gray-400 hover:text-white transition">Forex</a></li>
                    <li><a href="#" data-i18n="nav-crypto" class="mgl-spotlight-text text-gray-400 hover:text-white transition">Crypto</a></li>
                    <li><a href="/main_news.html" data-i18n="nav-news" class="mgl-spotlight-text text-gray-400 hover:text-white transition">Мэдээ</a></li>
                </ul>
            </div>

            <div>
                <h3 data-i18n="foot-about-title" class="text-brand-gold text-[10px] font-bold uppercase tracking-[0.16em] mb-2">Бидний тухай</h3>
                <ul class="space-y-1 text-xs font-medium">
                    <li><a href="/main_about.html" data-i18n="foot-about" class="mgl-spotlight-text text-gray-400 hover:text-white transition">Танилцуулга</a></li>
                    <li><a href="/main_contact.html" data-i18n="foot-contact" class="mgl-spotlight-text text-gray-400 hover:text-white transition">Холбоо барих</a></li>
                </ul>
            </div>
        </div>

        <div class="border-t border-brand-border/70 py-3 flex flex-col sm:flex-row justify-between items-center gap-2">
            <p class="mgl-spotlight-text text-[9px] text-gray-500 font-medium tracking-wider uppercase" data-text="&copy; 2026 MGLSIGNAL.COM. ALL RIGHTS RESERVED.">
                &copy; 2026 MGLSIGNAL.COM. ALL RIGHTS RESERVED.
            </p>
            
            <div class="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[9px] font-bold uppercase tracking-wider">
                <a href="main_privacy.html" data-i18n="privacy-page-title" class="mgl-spotlight-text text-gray-600 hover:text-brand-gold transition">Privacy Policy</a>
                <a href="main_terms.html" data-i18n="terms-page-title" class="mgl-spotlight-text text-gray-600 hover:text-brand-gold transition">Terms of Service</a>
                <a href="main_risk.html" data-i18n="risk-page-title" class="mgl-spotlight-text text-gray-600 hover:text-brand-gold transition">Risk Warning</a>
            </div>
        </div>
    </div>
</footer>
`;

// Insert the HTML right before the <script> tag for footer.js
if (document.currentScript) {
    document.currentScript.insertAdjacentHTML('beforebegin', footerHTML);
}

// ── БРО-ГИЙН ОЛОН ХЭЛНИЙ АВТОМАТ МАСК ЗАЛЬ (DYNAMICS SPOTLIGHT) ──
// Орчуулга хийгдэж үг солигдсоны дараа CSS-ийн data-text атрибутыг шинэ үгээр нь автомат сольдог функц
function syncSpotlightDataText() {
    setTimeout(() => {
        document.querySelectorAll('.mgl-spotlight-text[data-i18n]').forEach(el => {
            const currentVisibleText = el.textContent.trim();
            if (currentVisibleText) {
                el.setAttribute('data-text', currentVisibleText);
            }
        });
    }, 50); // Орчуулга бүрэн хийгдэж дуусахыг 50ms хүлээх хугацаа
}

// Хуудас анх ачаалагдахад ажиллуулах
document.addEventListener('DOMContentLoaded', syncSpotlightDataText);

// Хэрэв глобал хэл солих функц дуудагдвал давхар ажиллуулж маскийг шинэчилнэ
const originalFooterChangeLang = window.changeLang;
window.changeLang = function(lang) {
    if (originalFooterChangeLang) originalFooterChangeLang(lang);
    syncSpotlightDataText();
};