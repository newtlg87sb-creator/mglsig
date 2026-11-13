function calculateRSI(closes, period) {
    const rsi = new Array(closes.length).fill(50);
    if (closes.length < period + 1) return rsi;

    let gains = 0;
    let losses = 0;
    for (let index = 1; index <= period; index++) {
        const difference = closes[index] - closes[index - 1];
        if (difference >= 0) gains += difference;
        else losses -= difference;
    }

    let averageGain = gains / period;
    let averageLoss = losses / period;
    for (let index = period; index < closes.length; index++) {
        if (index > period) {
            const difference = closes[index] - closes[index - 1];
            const gain = difference >= 0 ? difference : 0;
            const loss = difference >= 0 ? 0 : -difference;
            averageGain = (averageGain * (period - 1) + gain) / period;
            averageLoss = (averageLoss * (period - 1) + loss) / period;
        }

        if (averageLoss === 0) {
            rsi[index] = 100;
        } else {
            const relativeStrength = averageGain / averageLoss;
            rsi[index] = 100 - 100 / (1 + relativeStrength);
        }
    }

    return rsi;
}

function calculateRsiRanges(klines, period, limit = 4) {
    if (!Array.isArray(klines) || klines.length < period + 2) return [];

    const rsi = calculateRSI(klines.map(candle => Number(candle[4])), period);
    const crossings = [];

    for (let index = 1; index < rsi.length - 1; index++) {
        const previousRsi = rsi[index - 1];
        const currentRsi = rsi[index];
        if (!Number.isFinite(previousRsi) || !Number.isFinite(currentRsi)) continue;

        const thresholds = currentRsi > previousRsi ? [30, 70] : [70, 30];
        for (const threshold of thresholds) {
            const crossedUp = previousRsi <= threshold && currentRsi > threshold;
            const crossedDown = previousRsi >= threshold && currentRsi < threshold;
            if (!crossedUp && !crossedDown) continue;

            const fraction = (threshold - previousRsi) / (currentRsi - previousRsi);
            const position = index - 1 + fraction;
            const lastCrossing = crossings[crossings.length - 1];
            if (lastCrossing?.level === threshold) lastCrossing.position = position;
            else crossings.push({ level: threshold, position });
        }
    }

    const ranges = [];
    for (let index = 0; index < crossings.length - 1; index++) {
        ranges.push({
            startPosition: crossings[index].position,
            endPosition: crossings[index + 1].position
        });
    }

    const lastCrossing = crossings[crossings.length - 1];
    const lastClosedCandleEnd = rsi.length - 1;
    if (lastCrossing && lastCrossing.position < lastClosedCandleEnd) {
        ranges.push({
            startPosition: lastCrossing.position,
            endPosition: lastClosedCandleEnd
        });
    }

    return ranges.slice(-limit);
}

function calculateRangeMass(klines, range) {
    let upMass = 0;
    let downMass = 0;
    const firstCandle = Math.max(0, Math.floor(range.startPosition));
    const lastCandle = Math.min(klines.length - 1, Math.ceil(range.endPosition) - 1);

    for (let index = firstCandle; index <= lastCandle; index++) {
        const candle = klines[index];
        const overlap = Math.max(
            0,
            Math.min(range.endPosition, index + 1) - Math.max(range.startPosition, index)
        );
        const open = Number(candle[1]);
        const close = Number(candle[4]);
        if (overlap > 0 && Number.isFinite(open) && Number.isFinite(close)) {
            if (close > open) upMass += (close - open) * overlap;
            else if (close < open) downMass += (open - close) * overlap;
        }
    }

    return { upMass, downMass };
}

function calculateRangeExtremes(klines, range) {
    let highExtreme = null;
    let lowExtreme = null;
    const firstCandle = Math.max(0, Math.floor(range.startPosition));
    const lastCandle = Math.min(klines.length - 1, Math.ceil(range.endPosition) - 1);

    for (let index = firstCandle; index <= lastCandle; index++) {
        const candle = klines[index];
        const overlap = Math.min(range.endPosition, index + 1) -
            Math.max(range.startPosition, index);
        if (overlap <= 0) continue;

        const high = Number(candle[2]);
        const low = Number(candle[3]);
        if (Number.isFinite(high) && (highExtreme === null || high > highExtreme.price)) {
            highExtreme = { index, price: high, type: "HH" };
        }
        if (Number.isFinite(low) && (lowExtreme === null || low < lowExtreme.price)) {
            lowExtreme = { index, price: low, type: "LL" };
        }
    }

    return [highExtreme, lowExtreme].filter(Boolean);
}

function isRangeExtremeUnbroken(klines, extreme) {
    for (let index = extreme.index + 1; index < klines.length - 1; index++) {
        const close = Number(klines[index][4]);
        if (!Number.isFinite(close)) continue;
        if (extreme.type === "HH" && close > extreme.price) return false;
        if (extreme.type === "LL" && close < extreme.price) return false;
    }

    return true;
}

function calculateBosTrend(bosLevels) {
    const hhCount = bosLevels.filter(level => level.type === "HH").length;
    const llCount = bosLevels.filter(level => level.type === "LL").length;
    const total = hhCount + llCount;

    if (total === 0) return { direction: "NEUTRAL", confidence: 0, hhCount, llCount };
    if (hhCount === llCount) return { direction: "NEUTRAL", confidence: 50, hhCount, llCount };

    const direction = hhCount > llCount ? "SHORT" : "LONG";
    const dominantCount = Math.max(hhCount, llCount);
    const opposingCount = Math.min(hhCount, llCount);
    const confidence = dominantCount >= 2 && opposingCount === 1
        ? 100
        : Math.round(50 + 50 * (dominantCount - opposingCount) / total * Math.min(total / 3, 1));

    return { direction, confidence, hhCount, llCount };
}

function calculatePaid2Analysis(klines, rsiPeriod) {
    const ranges = calculateRsiRanges(klines, rsiPeriod).map((range, rangeIndex) => ({
        ...range,
        mass: calculateRangeMass(klines, range),
        rangeIndex
    }));
    const bosLevels = [];

    ranges.forEach((range, rangeIndex) => {
        calculateRangeExtremes(klines, range)
            .filter(extreme => isRangeExtremeUnbroken(klines, extreme))
            .forEach(extreme => bosLevels.push({ ...extreme, rangeIndex }));
    });

    return {
        ranges,
        bosLevels,
        trend: calculateBosTrend(bosLevels)
    };
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
        return res.status(401).json({ error: "Sign in to use Trendcatcher" });
    }
    if (!supabaseUrl) {
        console.error("[PAID2 ACCESS ERROR] Supabase configuration is incomplete");
        return res.status(503).json({ error: "Trendcatcher access is temporarily unavailable" });
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
            console.error("[PAID2 ACCESS ERROR] Failed to load membership profile");
            return res.status(503).json({ error: "Unable to verify Trendcatcher access" });
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
                error: "An active Beta or Alpha subscription is required to use Trendcatcher"
            });
        }
    } catch (error) {
        console.error("[PAID2 ACCESS ERROR]", error?.message || error);
        return res.status(503).json({ error: "Unable to verify Trendcatcher access" });
    }

    const { klines, rsiPeriod = 14 } = req.body || {};
    if (!Array.isArray(klines) || klines.length < 5 || klines.length > 2000 ||
        klines.some(kline => !Array.isArray(kline) || kline.length < 6 ||
            ![0, 1, 2, 3, 4, 5].every(index => Number.isFinite(Number(kline[index]))))) {
        return res.status(400).json({ error: "Invalid candle data" });
    }

    const period = Number(rsiPeriod);
    if (!Number.isInteger(period) || period < 1 || period > 500) {
        return res.status(400).json({ error: "Invalid RSI period" });
    }

    try {
        return res.status(200).json(calculatePaid2Analysis(klines, period));
    } catch (error) {
        console.error("[PAID2 ANALYSIS ERROR]", error);
        return res.status(500).json({ error: "Trendcatcher analysis failed" });
    }
}
