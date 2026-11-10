/**
 * Access Control Script - MGL Signal
 * Paid chart access is checked against the current Supabase session and profile.
 */
(async function() {
    const currentPage = window.location.pathname.split('/').pop();
    const requiredMemberships = {
        'paidsignal1.html': ['alpha', 'beta'],
        'paidsignal2.html': ['gamma']
    };
    const allowedMemberships = requiredMemberships[currentPage];
    if (!allowedMemberships) return;

    const overlay = document.createElement('div');
    overlay.id = 'lock-overlay';
    overlay.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:99999',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:24px',
        'background:rgba(5,7,10,.97)',
        'color:#fff',
        'font:600 16px sans-serif',
        'text-align:center'
    ].join(';');
    overlay.textContent = 'Гишүүний эрхийг шалгаж байна...';
    document.body.appendChild(overlay);

    function denyAccess(destination, message) {
        overlay.textContent = message;
        window.setTimeout(() => window.location.replace(destination), 900);
    }

    try {
        if (typeof sb === 'undefined' || !sb) {
            throw new Error('Supabase authentication is unavailable');
        }

        const { data: { session }, error: sessionError } = await sb.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user?.id) {
            denyAccess('/main_login.html', 'Энэ хуудсыг үзэхийн тулд нэвтэрнэ үү.');
            return;
        }

        const { data: profile, error: profileError } = await sb
            .from('User control')
            .select('membership_type, membership_expires_at')
            .eq('id', session.user.id)
            .maybeSingle();
        if (profileError) throw profileError;

        const membershipType = String(profile?.membership_type || '').toLowerCase();
        const expiration = profile?.membership_expires_at
            ? Date.parse(profile.membership_expires_at)
            : null;
        const isExpired = expiration !== null &&
            (!Number.isFinite(expiration) || expiration <= Date.now());

        if (!allowedMemberships.includes(membershipType) || isExpired) {
            denyAccess(
                '/main_pricing.html',
                isExpired
                    ? 'Таны багцын эрхийн хугацаа дууссан байна.'
                    : 'Энэ хуудсыг үзэхэд тохирох төлбөртэй багц шаардлагатай.'
            );
            return;
        }

        overlay.remove();
    } catch (error) {
        console.error('[ACCESS CONTROL ERROR] Unable to verify paid page access:', error);
        denyAccess('/main_login.html', 'Гишүүний эрхийг шалгаж чадсангүй. Дахин нэвтэрнэ үү.');
    }
})();
