// api/index.js (Vercel Serverless Function - Route: /api?id=...)
import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;
    res.setHeader('Content-Type', 'application/json');

    if (!id) {
        return res.status(400).json({ error: "id required" });
    }

    // ─── BINANCE API CONFIGURATION (Environment Variables se lein) ───
    const API_KEY = process.env.BINANCE_API_KEY || "dl7afnQdUgJl8QqVD0vlN1qk9B6ECILcyPHBFhDYw1oqu3JZlJpEkmg0SGTvW28L";
    const SECRET_KEY = process.env.BINANCE_SECRET_KEY || "Obl08n7w6wO7S2OZcNajlXHBYkHRDCRYSrXnozv88VsYfAjRvdpbvTUf0eRdWVmH";

    try {
        // 1. Check karo ke user pehle se database/remote API me registered aur active hai ya nahi
        const mainAuthAPI = "https://magic-scripts.vercel.app/api/q?id=" + id;
        const mainRes = await fetch(mainAuthAPI).catch(() => null);
        const mainData = mainRes && mainRes.ok ? await mainRes.json() : null;

        const now = new Date();

        if (mainData && mainData.authorized === true) {
            // Check expiry date (Month completion auto-lock check)
            if (mainData.expiresAt) {
                const expiryDate = new Date(mainData.expiresAt);
                if (expiryDate < now) {
                    return res.status(200).json({ 
                        status: "expired", 
                        authorized: false, 
                        message: "Subscription expired after 1 month. Please renew." 
                    });
                }
            }
            return res.status(200).json({ status: "success", authorized: true });
        }

        // 2. Agar authorized nahi hai, toh Binance API se deposit/payment history check karo
        if (API_KEY && SECRET_KEY) {
            const timestamp = Date.now();
            const queryString = `timestamp=${timestamp}`;
            const signature = crypto
                .createHmac('sha256', SECRET_KEY)
                .update(queryString)
                .digest('hex');

            const binanceUrl = `https://api.binance.com/sapi/v1/capital/deposit/hisrec?${queryString}&signature=${signature}`;
            
            const binanceRes = await fetch(binanceUrl, {
                headers: {
                    'X-MBX-APIKEY': API_KEY
                }
            });

            if (binanceRes.ok) {
                const deposits = await binanceRes.json();
                const validPayment = Array.isArray(deposits) && deposits.find(dep => dep.status === 1);

                if (validPayment) {
                    return res.status(200).json({ 
                        status: "verified", 
                        authorized: true, 
                        message: "Payment received successfully! Script unlocked." 
                    });
                }
            }
        }

        // Agar payment nahi mili ya unauthorized hai
        return res.status(200).json({ 
            status: "locked", 
            authorized: false, 
            message: "Payment not detected or unauthorized device ID." 
        });

    } catch (error) {
        console.error("Payment API Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
                                           }
