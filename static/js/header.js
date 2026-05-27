const headerHTML = `    <style>
        nav {
            top: 28px !important; /* Donate bar-ийн өндөртэй тааруулж доошлуулна */
        }
        @media (max-width: 640px) {
            nav { top: 28px !important; }
        }
    </style>

    <div class="fixed top-0 w-full z-[60] bg-brand-gold py-1.5 px-6 border-b border-black/10">
        <div class="max-w-7xl mx-auto flex justify-between items-center relative">
            <div class="flex items-center space-x-2">
                <span class="flex h-2 w-2 relative">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
                </span>
                <p data-i18n="donate-bar-text" class="text-[9px] font-black uppercase tracking-[0.1em] text-black">
                    Support the Community: <span class="hidden sm:inline">Хөгжүүлэлтийг дэмжих</span>
                </p>
            </div>

            <!-- CENTER: UPDATE ALERT -->
            <div class="absolute left-1/2 transform -translate-x-1/2 cursor-pointer group" onclick="document.getElementById('update-modal').classList.remove('hidden')">
                <div class="flex items-center space-x-1.5 bg-black/5 px-3 py-0.5 rounded-full hover:bg-black/10 transition border border-black/5">
                    <i class="fas fa-info-circle text-[9px] text-black"></i>
                    <span data-i18n="update-info-btn" class="text-[9px] font-black text-black uppercase tracking-tight">About Update</span>
                    <span data-i18n="last-update-prefix" class="text-[9px] font-black text-black opacity-70 ml-1"></span>
                    <span id="header-last-update-time" class="text-[9px] font-black text-black opacity-70"></span>
                </div>
            </div>

            <div class="flex items-center space-x-4">
                <div class="hidden md:flex items-center space-x-2 border-r border-black/20 pr-4">
                    <i class="fab fa-binance text-[10px] text-black"></i>
                    <code class="text-[9px] font-bold text-black opacity-80 select-all">BEP20: 0xc7b56....c4f8c4</code>
                </div>
                <a href="main_about.html" data-i18n="donate-bar-btn" class="text-[9px] font-black bg-black text-white px-3 py-0.5 rounded-full hover:bg-gray-800 transition uppercase tracking-tighter">
                    Donate Now
                </a>
            </div>
        </div>
    </div>

    <!-- UPDATE MODAL -->
    <div id="update-modal" class="fixed inset-0 z-[100] hidden flex items-center justify-center bg-black/90 backdrop-blur-sm px-4">
        <div class="bg-brand-dark-blue border border-brand-gold rounded-2xl p-6 md:p-8 max-w-sm w-full relative shadow-2xl transform scale-100 transition-all">
            <button onclick="document.getElementById('update-modal').classList.add('hidden')" class="absolute top-4 right-4 text-gray-500 hover:text-white transition">
                <i class="fas fa-times"></i>
            </button>
            
            <div class="text-center mb-6">
                <div class="w-14 h-14 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-gold/20 animate-pulse">
                    <i class="fas fa-sync-alt text-brand-gold text-2xl"></i>
                </div>
                <h3 data-i18n="update-modal-title" class="text-xl font-black text-white uppercase tracking-wider mb-2">Daily Updates</h3>
                <p data-i18n="update-modal-desc" class="text-gray-400 text-xs leading-relaxed">
                    We update the site daily. If you see old data, please clear your cache.
                </p>
            </div>

            <div class="bg-black/40 p-4 rounded-xl border border-brand-border mb-6 text-center">
                <p class="text-[10px] text-gray-500 font-bold uppercase mb-2">Recommended: Clear Cache</p>
                <code class="text-brand-gold text-xs font-mono font-bold bg-brand-gold/10 px-2 py-1 rounded">CTRL + F5</code>
            </div>

            <button onclick="window.location.reload(true)" class="w-full bg-brand-gold text-black font-bold py-3 rounded-lg hover:bg-white transition uppercase text-xs tracking-widest shadow-lg shadow-brand-gold/20 flex items-center justify-center">
                <i class="fas fa-redo-alt mr-2"></i> <span data-i18n="btn-refresh">REFRESH NOW</span>
            </button>
        </div>
    </div>

    <nav class="bg-black/90 backdrop-blur-md fixed w-full z-50 border-b border-brand-border">
        <div class="max-w-7xl mx-auto px-6">
            <div class="flex justify-between items-center h-14">
                <a href="/index.html" class="flex items-center">
                    <span class="text-xl md:text-2xl font-black tracking-tighter text-white">MGL<span class="text-brand-gold">Signal</span></span>
                </a>

                <div class="hidden md:flex items-center space-x-6 text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400">
                    <a href="/index.html" data-i18n="nav-home" class="py-1 hover:text-white transition">Нүүр</a>
                    
                    <div class="relative dropdown group">
                        <button class="flex items-center hover:text-white transition py-1">
                            <span data-i18n="nav-forex">Forex</span>
                            <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" stroke-width="3"></path></svg>
                        </button>
                        <div class="hidden dropdown-menu absolute left-0 mt-0 pt-4 w-44 z-50">
                            <div class="bg-brand-dark-blue border border-brand-border shadow-2xl overflow-hidden">
                                <a href="#" data-i18n="drop-major" class="block px-4 py-2.5 hover:bg-brand-gold hover:text-black transition border-b border-brand-border/50">Major Pairs</a>
                                <a href="#" data-i18n="drop-minor" class="block px-4 py-2.5 hover:bg-brand-gold hover:text-black transition">Minor Pairs</a>
                            </div>
                        </div>
                    </div>

                    <div class="relative dropdown group">
                        <button class="flex items-center hover:text-white transition py-1">
                            <span data-i18n="nav-crypto">Crypto</span>
                            <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" stroke-width="3"></path></svg>
                        </button>
                        <div class="hidden dropdown-menu absolute left-0 mt-0 pt-4 w-44 z-50">
                            <div class="bg-brand-dark-blue border border-brand-border shadow-2xl overflow-hidden">
                                <a href="/main_bitcoin_tools.html" data-i18n="drop-btc" class="block px-4 py-2.5 hover:bg-brand-gold hover:text-black transition border-b border-brand-border/50">Bitcoin Tools</a>
                                <a href="/main_altcoin_tools.html" data-i18n="drop-alt" class="block px-4 py-2.5 hover:bg-brand-gold hover:text-black transition">Altcoin Signals</a>
                            </div>
                        </div>
                    </div>

                    <a href="/main_news.html" data-i18n="nav-news" class="py-1 hover:text-white transition">Мэдээ</a>

                    <div class="relative dropdown group">
                        <button class="flex items-center hover:text-white transition py-1 text-brand-gold font-black">
                            <span data-i18n="nav-more">ЦЭС</span>
                            <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" stroke-width="3"></path></svg>
                        </button>
                        <div class="hidden dropdown-menu absolute right-0 mt-0 pt-4 w-56 z-[100]">
                            <div class="bg-brand-dark-blue border border-brand-border shadow-2xl overflow-hidden backdrop-blur-xl">
                                <a href="/main_signals.html" data-i18n="sig-title" class="block px-5 py-3 text-[10px] hover:bg-brand-gold hover:text-black transition border-b border-brand-border/50 font-bold">Сигналууд</a>
                                <a href="/exchanges.html" data-i18n="nav-kucoin-spot" class="block px-5 py-3 text-[10px] hover:bg-brand-gold hover:text-black transition border-b border-brand-border/50 font-bold">Exchanges Live Data</a>
                                <a href="/main_alpha_signals.html" data-i18n="nav-alpha" class="block px-5 py-3 text-[10px] hover:bg-brand-gold hover:text-black transition border-b border-brand-border/50 font-bold">Alpha Signals</a>
                                <a href="/main_about.html" data-i18n="foot-about" class="block px-5 py-3 text-[10px] bg-brand-gold text-black border-b border-brand-border/50 font-bold">Бидний тухай</a>
                                <a href="/main_contact.html" data-i18n="foot-contact" class="block px-5 py-3 text-[10px] hover:bg-brand-gold hover:text-black transition border-b border-brand-border/50 font-bold">Холбоо барих</a>
                                <a href="/main_New_projects.html" data-i18n="nav-projects" class="block px-5 py-3 text-[10px] hover:bg-brand-gold hover:text-black transition border-b border-brand-border/50 font-bold">Шинэ төслүүд</a>
                                <a href="/main_knowledge.html" data-i18n="nav-knowledge" class="block px-5 py-3 text-[10px] hover:bg-brand-gold hover:text-black transition font-bold">Мэдлэг</a>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex items-center space-x-4">
                    <div class="hidden md:flex items-center space-x-3 border-r border-brand-border pr-4 mr-1">
                        <!-- Guest View (Desktop) -->
                        <div id="desktop-guest" class="flex items-center space-x-3">
                            <a href="main_login.html" data-i18n="btn-login" class="text-[10px] font-bold text-gray-400 hover:text-white transition uppercase">Login</a>
                            <a href="main_register.html" data-i18n="btn-reg" class="bg-brand-gold text-black px-3 py-1.5 rounded-sm text-[10px] font-black uppercase hover:bg-white transition">Register</a>
                        </div>
                        <!-- User View (Desktop) -->
                        <div id="desktop-user" class="hidden flex items-center space-x-3">
                            <span id="user-display-name" class="text-[10px] font-bold text-brand-gold uppercase tracking-wider">User</span>
                            <button onclick="handleLogout()" class="text-[10px] font-bold text-gray-500 hover:text-white transition uppercase ml-2">Logout</button>
                        </div>
                    </div>

                    <div class="flex bg-brand-dark-blue border border-brand-border rounded-full p-0.5 text-[9px] font-black">
                        <button id="btn-mn" onclick="changeLang('mn')" class="px-2.5 py-1 rounded-full bg-brand-gold text-black transition">MN</button>
                        <button id="btn-en" onclick="changeLang('en')" class="px-2.5 py-1 rounded-full text-gray-500 hover:text-white transition">EN</button>
                    </div>
                    
                    <button class="md:hidden mobile-menu-button focus:outline-none">
                        <svg class="w-6 h-6 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16m-7 6h7"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>

        <!-- Mobile Menu -->
        <div class="mobile-menu hidden md:hidden bg-brand-dark-blue border-b border-brand-border px-6 py-6 space-y-4">
            <a href="/index.html" data-i18n="nav-home" class="block text-white font-bold uppercase text-xs">Нүүр</a>
            
            <!-- Forex Section -->
            <div class="space-y-2">
                <p data-i18n="nav-forex" class="text-[10px] text-gray-500 font-black uppercase tracking-widest">Forex</p>
                <div class="pl-4 space-y-2 border-l border-brand-border">
                    <a href="#" data-i18n="drop-major" class="block text-white text-xs font-bold uppercase">Major Pairs</a>
                    <a href="#" data-i18n="drop-minor" class="block text-white text-xs font-bold uppercase">Minor Pairs</a>
                </div>
            </div>

            <!-- Crypto Section -->
            <div class="space-y-2">
                <p data-i18n="nav-crypto" class="text-[10px] text-gray-500 font-black uppercase tracking-widest">Crypto</p>
                <div class="pl-4 space-y-2 border-l border-brand-border">
                    <a href="/main_bitcoin_tools.html" data-i18n="drop-btc" class="block text-white text-xs font-bold uppercase">Bitcoin Tools</a>
                    <a href="/main_altcoin_tools.html" data-i18n="drop-alt" class="block text-white text-xs font-bold uppercase">Altcoin Signals</a>
                    <a href="/exchanges.html" data-i18n="nav-kucoin-spot" class="block text-brand-gold text-xs font-bold uppercase">Exchanges Data</a>
                </div>
            </div>

            <a href="/main_news.html" data-i18n="nav-news" class="block text-white font-bold uppercase text-xs">Мэдээ</a>
            <a href="/main_signals.html" data-i18n="sig-title" class="block text-gray-400 font-bold uppercase text-xs">Сигналууд</a>
            <a href="/main_alpha_signals.html" data-i18n="nav-alpha" class="block text-brand-gold font-bold uppercase text-xs italic">Alpha Signals</a>
            <a href="/main_New_projects.html" data-i18n="nav-projects" class="block text-gray-400 font-bold uppercase text-xs">Шинэ төслүүд</a>
            
            <div class="grid grid-cols-2 gap-4">
                <a href="/main_knowledge.html" data-i18n="nav-knowledge" class="text-gray-400 font-bold uppercase text-[10px]">Мэдлэг</a>
                <a href="/main_about.html" data-i18n="foot-about" class="text-gray-400 font-bold uppercase text-[10px]">Бидний тухай</a>
            </div>

            <div class="pt-4 border-t border-brand-border flex flex-col space-y-4">
                <!-- Guest View (Mobile) -->
                <div id="mobile-guest" class="grid grid-cols-2 gap-4">
                    <a href="main_login.html" data-i18n="btn-login" class="text-center py-2 border border-brand-border rounded text-white text-xs font-bold uppercase hover:border-brand-gold transition">Нэвтрэх</a>
                    <a href="main_register.html" data-i18n="btn-reg" class="text-center py-2 bg-brand-gold rounded text-black text-xs font-bold uppercase hover:bg-white transition">Бүртгүүлэх</a>
                </div>
                <!-- User View (Mobile) -->
                <div id="mobile-user" class="hidden flex flex-col space-y-3">
                    <div class="flex items-center justify-center space-x-2">
                        <i class="fas fa-user text-brand-gold"></i>
                        <span id="mobile-user-name" class="text-white text-sm font-bold uppercase">User</span>
                    </div>
                    <button onclick="handleLogout()" class="text-center py-2 border border-brand-border rounded text-red-500 text-xs font-bold uppercase hover:bg-red-500/10 transition">Гарах</button>
                </div>
                <a href="/main_contact.html" data-i18n="foot-contact" class="text-center text-gray-500 text-[10px] font-bold uppercase pt-2">Холбоо барих</a>
            </div>
        </div>
    </nav>
`;

// Supabase client-ийг тохируулах
// Public болгох гэж байгаа тул утгуудыг шууд бичихгүй байхыг зөвлөж байна.
// Гэвч static JS дээр Environment Variable шууд уншиж болдоггүй тул Anon Key-г энд үлдээж болно.
const SB_URL = "https://bsdkbxyjwjljximdxdst.supabase.co"; 
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzZGtieHlqd2psanhpbWR4ZHN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzODg1MTQsImV4cCI6MjA5MDk2NDUxNH0.Qwfpd0cEaAKwlv5B-Uh0MlTLR-WH8qt19HHlTxUnUYs";
const sb = (typeof supabase !== 'undefined') ? supabase.createClient(SB_URL, SB_KEY) : null;

// This will insert the HTML right before the <script> tag for header.js
// It's a safe and modern replacement for document.write()
if (document.currentScript) {
    document.currentScript.insertAdjacentHTML('beforebegin', headerHTML);
}

// Global function for Logout
window.handleLogout = async function() {
    // Supabase сессийг бүрэн хаах
    if (sb) {
        await sb.auth.signOut();
    }
    localStorage.removeItem('user');
    window.location.href = '/main_login.html';
};

function changeLang(lang) {
    localStorage.setItem('lang', lang);
    
    if (typeof translations !== 'undefined') {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[lang] && translations[lang][key]) {
                el.innerHTML = translations[lang][key];
            }
        });
        // Handle placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (translations[lang] && translations[lang][key]) {
                el.placeholder = translations[lang][key];
            }
        });
    }

    const btnMn = document.getElementById('btn-mn');
    const btnEn = document.getElementById('btn-en');

    if (btnMn && btnEn) {
        if (lang === 'mn') {
            btnMn.className = "px-2.5 py-1 rounded-full bg-brand-gold text-black transition";
            btnEn.className = "px-2.5 py-1 rounded-full text-gray-500 hover:text-white transition";
        } else {
            btnEn.className = "px-2.5 py-1 rounded-full bg-brand-gold text-black transition";
            btnMn.className = "px-2.5 py-1 rounded-full text-gray-500 hover:text-white transition";
        }
    }
}


// Function to check login status and update UI
async function checkUserLogin() {
    let userStr = localStorage.getItem('user');
    
    // 1. Try to sync with Supabase for real-time status update
    if (sb) {
        try {
            const { data: { session } } = await sb.auth.getSession();
            if (session && session.user) {
                const user = session.user;
                
                // Профайл хүснэгтээс мэдээлэл татах
                const { data: profile, error: profileError } = await sb
                    .from('User control')
                    .select('username, membership_type, membership_expires_at')
                    .eq('id', user.id)
                    .maybeSingle(); // .single() ашиглавал өгөгдөл байхгүй үед алдаа заадаг

                if (profileError) console.error("Supabase Sync Error:", profileError);
                
                const userData = {
                    id: user.id,
                    username: profile?.username || user.user_metadata.display_name || user.email.split('@')[0],
                    email: user.email,
                    membership_type: profile?.membership_type || 'free',
                    membership_expires_at: profile?.membership_expires_at || user.user_metadata.membership_expires_at || null
                };
                
                // Update local storage with latest DB data
                localStorage.setItem('user', JSON.stringify(userData));
                userStr = JSON.stringify(userData);
            } else if (!session && userStr) {
                localStorage.removeItem('user');
                userStr = null;
            }
        } catch (err) {
            console.warn("Supabase sync failed, using cached data", err);
        }
    }

    if (userStr && userStr !== "undefined") {
        try {
            const user = JSON.parse(userStr);
            
            // Desktop UI Update
            const dGuest = document.getElementById('desktop-guest');
            const dUser = document.getElementById('desktop-user');
            const dName = document.getElementById('user-display-name');

            // Mobile UI Update
            const mGuest = document.getElementById('mobile-guest');
            const mUser = document.getElementById('mobile-user');
            const mName = document.getElementById('mobile-user-name');

            // Helper to generate the display HTML based on membership
            const getStatusHTML = (username, type, expiresAt) => {
                const mType = (type || '').toLowerCase().trim(); // Том жижиг үсгийг үл харгалзан шалгана
                if (mType === 'alpha' && expiresAt) {
                    const now = new Date();
                    const expires = new Date(expiresAt);
                    if (expires > now) {
                        const diffDays = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
                        return `<span class="text-brand-gold flex items-center"><i class="fas fa-crown mr-1.5"></i> ALPHA: ${username} <span class="ml-1.5 opacity-70 text-[9px]">(${diffDays}d left)</span></span>`;
                    }
                }
                return `<span class="text-gray-400 flex items-center"><i class="fas fa-user-circle mr-1.5"></i> FREE: ${username}</span>`;
            };

            if(dGuest && dUser && dName) {
                dGuest.classList.add('hidden');
                dGuest.classList.remove('flex');
                dUser.classList.remove('hidden');
                dName.innerHTML = getStatusHTML(user.username, user.membership_type, user.membership_expires_at);
            }

            if(mGuest && mUser && mName) {
                mGuest.classList.add('hidden');
                mGuest.classList.remove('grid');
                mUser.classList.remove('hidden');
                mName.innerHTML = getStatusHTML(user.username, user.membership_type, user.membership_expires_at);
            }
        } catch (e) {
            console.error("Error parsing user data", e);
            localStorage.removeItem('user'); // Алдаатай өгөгдөл байвал устгана
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuButton = document.querySelector('.mobile-menu-button');
    const mobileMenu = document.querySelector('.mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    const savedLang = localStorage.getItem('lang') || 'mn';
    changeLang(savedLang);
    
    // --- AUTOMATIC UPDATE DETECTION ---
    async function autoDetectUpdateTime() {
        const updateTimeSpan = document.getElementById('header-last-update-time');
        if (!updateTimeSpan) return;

        try {
            // Үндсэн index.html файлын серверийн мэдээллийг шалгах
            const response = await fetch(window.location.origin + '/index.html', { method: 'HEAD' });
            const lastModified = response.headers.get('Last-Modified');
            
            if (lastModified) {
                const date = new Date(lastModified);
                const HH = String(date.getHours()).padStart(2, '0');
                const mm = String(date.getMinutes()).padStart(2, '0');
                const DD = String(date.getDate()).padStart(2, '0');
                const MM = String(date.getMonth() + 1).padStart(2, '0');
                const YY = String(date.getFullYear()).slice(-2);
                
                updateTimeSpan.textContent = `${HH}:${mm} ${DD}/${MM}/${YY}`;
            }
        } catch (e) {
            console.warn("Update check failed, keeping fallback time");
        }
    }
    autoDetectUpdateTime();
    // ----------------------------------

    // Check login status on page load
    checkUserLogin();
});