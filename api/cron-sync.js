export default async function handler(req, res) {
    // Зөвхөн GET хүсэлт зөвшөөрөх
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // Cron-job.org-оос явуулж буй нууц түлхүүрийг шалгах
    const secretKey = req.query.secret;
    const cronSecret = "21f19ae0-b35e-4984-b8dc-dc8e463b0155"; // Чиний өгсөн нууц түлхүүр

    if (secretKey !== cronSecret) {
        return res.status(401).json({ error: "Unauthorized cron access" });
    }

    try {
        // --- Энд чиний Binance-ээс дата татах, тооцоолох болон Supabase рүү хадгалах логик чинь ажиллана ---
        // Жишээ нь:
        // const binanceData = await fetchBinanceData();
        // await saveToSupabase(binanceData);

        return res.status(200).json({ 
            success: true, 
            message: "Cron sync executed successfully", 
            timestamp: new Date().toISOString() 
        });

    } catch (error) {
        console.error("Cron sync error:", error);
        return res.status(500).json({ error: error.message });
    }
}