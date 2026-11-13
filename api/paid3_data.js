function calculateEMA(data, span) {
    const multiplier = 2 / (span + 1);
    const values = [];
    let previous = data[0];

    for (let index = 0; index < data.length; index++) {
        previous = index === 0
            ? data[0]
            : data[index] * multiplier + previous * (1 - multiplier);
        values.push(previous);
    }

    return values;
}

function calculateMacdLine(klines, fast, slow) {
    const closes = klines.map(kline => Number(kline[4]));
    const fastEma = calculateEMA(closes, fast);
    const slowEma = calculateEMA(closes, slow);
    return fastEma.map((value, index) => value - slowEma[index]);
}

function calculateSignalStates(klines, fast, slow) {
    const macdLine = calculateMacdLine(klines, fast, slow);
    const firstSlope = Number(macdLine[1].toFixed(8)) > Number(macdLine[0].toFixed(8))
        ? "long"
        : "short";
    const states = new Array(macdLine.length).fill(firstSlope);

    for (let index = 2; index < macdLine.length; index++) {
        const previousMacdLine = Number(macdLine[index - 1].toFixed(8));
        const previous2MacdLine = Number(macdLine[index - 2].toFixed(8));
        states[index] = previousMacdLine > previous2MacdLine ? "long" : "short";
    }

    return states;
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseApiKey = req.headers.apikey;

    if (!accessToken || !supabaseApiKey) {
        return res.status(401).json({ error: "Sign in to use the MACD signal chart" });
    }
    if (!supabaseUrl) {
        console.error("[DATA3 ACCESS ERROR] Supabase configuration is incomplete");
        return res.status(503).json({ error: "Signal access is temporarily unavailable" });
    }

    let user;
    try {
        const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                apikey: supabaseApiKey,
                Authorization: `Bearer ${accessToken}`
            },
            signal: AbortSignal.timeout(10000)
        });
        if (!authResponse.ok) {
            return res.status(401).json({ error: "Your session has expired. Please sign in again." });
        }

        user = await authResponse.json();
        if (!user.id) {
            return res.status(401).json({ error: "Unable to verify your account" });
        }
    } catch (error) {
        return res.status(401).json({ error: "Authentication failed" });
    }

    try {
        const profileUrl = new URL("/rest/v1/User%20control", supabaseUrl);
        profileUrl.searchParams.set("id", `eq.${user.id}`);
        profileUrl.searchParams.set("select", "membership_type,membership_expires_at");
        const profileResponse = await fetch(profileUrl, {
            headers: {
                apikey: supabaseApiKey,
                Authorization: `Bearer ${accessToken}`
            },
            signal: AbortSignal.timeout(10000)
        });
        if (!profileResponse.ok) {
            console.error("[DATA3 ACCESS ERROR] Failed to load membership profile");
            return res.status(503).json({ error: "Unable to verify signal access" });
        }

        const profiles = await profileResponse.json();
        const profile = Array.isArray(profiles) ? profiles[0] : null;
        const membershipType = String(profile?.membership_type || "").toLowerCase();
        const expiration = profile?.membership_expires_at
            ? Date.parse(profile.membership_expires_at)
            : null;
        const isExpired = expiration !== null &&
            (!Number.isFinite(expiration) || expiration <= Date.now());
        if (!["alpha", "beta"].includes(membershipType) || isExpired) {
            return res.status(403).json({
                error: "An active Beta or Alpha subscription is required to use this signal"
            });
        }
    } catch (error) {
        console.error("[DATA3 ACCESS ERROR]", error?.message || error);
        return res.status(503).json({ error: "Unable to verify signal access" });
    }

    const { klines, fast = 12, slow = 26 } = req.body || {};
    if (!Array.isArray(klines) || klines.length < 5 || klines.length > 2000 ||
        klines.some(kline => !Array.isArray(kline) || kline.length < 6 ||
            ![0, 1, 2, 3, 4, 5].every(index => Number.isFinite(Number(kline[index]))))) {
        return res.status(400).json({ error: "Invalid candle data" });
    }

    const fastPeriod = Number(fast);
    const slowPeriod = Number(slow);
    if (![fastPeriod, slowPeriod].every(period =>
        Number.isInteger(period) && period > 0 && period <= 500
    ) || fastPeriod >= slowPeriod) {
        return res.status(400).json({ error: "Invalid MACD periods" });
    }

    try {
        const states = calculateSignalStates(klines, fastPeriod, slowPeriod);
        return res.status(200).json({ states });
    } catch (error) {
        console.error("[DATA3 SIGNAL ERROR]", error);
        return res.status(500).json({ error: "MACD signal calculation failed" });
    }
}
