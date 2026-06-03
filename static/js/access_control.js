/**
 * Access Control Script - MGL Signal
 * Шалгаж буй хуудсанд нэвтрэх эрх байгаа эсэхийг хянана.
 */
(function() {
    const userStr = localStorage.getItem('user');
    const currentPage = window.location.pathname;

    // Заавал нэвтрэх шаардлагатай хуудсуудын жагсаалт
    const authRequiredPages = ['main_alpha_signals.html'];
    const needsAuth = authRequiredPages.some(p => currentPage.includes(p));

    if (needsAuth && (!userStr || userStr === "undefined")) {
        // Хэрэв нэвтрээгүй бол хуудсыг бүхэлд нь түгжих Overlay үүсгэнэ
        document.addEventListener('DOMContentLoaded', () => {
            document.body.insertAdjacentHTML('afterbegin', `
                <div id="lock-overlay" class="fixed inset-0 bg-brand-dark/95 backdrop-blur-md z-[9999] flex items-center justify-center p-6 text-center">
                    <div class="max-w-md w-full bg-brand-dark-blue border border-brand-border p-10 rounded-3xl shadow-2xl transform scale-110">
                        <div class="w-20 h-20 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-brand-gold/20">
                            <i class="fas fa-lock text-brand-gold text-3xl"></i>
                        </div>
                        <h2 class="text-2xl font-black text-white mb-4 uppercase tracking-tighter">Нэвтрэх шаардлагатай</h2>
                        <p class="text-gray-400 text-sm mb-8 leading-relaxed">Уучлаарай, энэ хуудсыг үзэхийн тулд та заавал системд нэвтэрсэн байх шаардлагатай.</p>
                        <div class="flex flex-col gap-3">
                            <a href="/main_login.html" class="w-full bg-brand-gold text-black font-black py-4 rounded-xl hover:bg-white transition uppercase text-xs tracking-widest shadow-lg shadow-brand-gold/20">НЭВТРЭХ</a>
                            <a href="/index.html" class="w-full bg-white/5 text-gray-500 font-bold py-3 rounded-xl hover:text-white transition uppercase text-[10px]">Нүүр хуудас руу буцах</a>
                        </div>
                    </div>
                </div>
            `);
            document.body.style.overflow = 'hidden'; // Скрол хийхийг зогсооно
        });
        return;
    }

    const user = JSON.parse(userStr);

    // Alpha хуудсанд орох гэж байвал эрхийг нь шалгах
    if (currentPage.includes('main_alpha_signals.html')) {
        const now = new Date();
        const expiresAt = user.membership_expires_at ? new Date(user.membership_expires_at) : null;
        const isExpired = expiresAt && expiresAt < now;

        if (user.membership_type !== 'alpha' || isExpired) {
            const msg = isExpired ? 'Таны ALPHA эрхийн хугацаа дууссан байна.' : 'Энэ хуудсанд нэвтрэхийн тулд ALPHA багцтай байх шаардлагатай.';
            alert(msg);
            window.location.href = 'main_pricing.html';
        }
    }
})();