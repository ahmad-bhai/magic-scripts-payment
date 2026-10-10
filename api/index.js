// api/index.js (Vercel Serverless Function - Payment & Tier Permission Engine)
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

    const API_KEY = process.env.BINANCE_API_KEY || "dl7afnQdUgJl8QqVD0vlN1qk9B6ECILcyPHBFhDYw1oqu3JZlJpEkmg0SGTvW28L";
    const SECRET_KEY = process.env.BINANCE_SECRET_KEY || "Obl08n7w6wO7S2OZcNajlXHBYkHRDCRYSrXnozv88VsYfAjRvdpbvTUf0eRdWVmH";

    try {
        // 1. Check existing database status
        const mainAuthAPI = "https://magic-scripts.vercel.app/api/q?id=" + id;
        const mainRes = await fetch(mainAuthAPI).catch(() => null);
        const mainData = mainRes && mainRes.ok ? await mainRes.json() : null;

        const now = new Date();

        if (mainData && mainData.authorized === true) {
            if (mainData.expiresAt && new Date(mainData.expiresAt) < now) {
                return res.status(200).json({ status: "expired", authorized: false, permissions: {} });
            }
            return res.status(200).json({ status: "success", authorized: true, permissions: mainData.permissions });
        }

        // 2. Fetch Binance Deposit / Payment History using System-Generated API/Secret Keys
        if (API_KEY && SECRET_KEY) {
            const timestamp = Date.now();
            const queryString = `timestamp=${timestamp}`;
            const signature = crypto
                .createHmac('sha256', SECRET_KEY)
                .update(queryString)
                .digest('hex');

            const binanceUrl = `https://api.binance.com/sapi/v1/capital/deposit/hisrec?${queryString}&signature=${signature}`;
            
            const binanceRes = await fetch(binanceUrl, {
                headers: { 'X-MBX-APIKEY': API_KEY }
            });

            if (binanceRes.ok) {
                const deposits = await binanceRes.json();
                const validPayment = Array.isArray(deposits) && deposits.find(dep => dep.status === 1);

                if (validPayment) {
                    const amount = parseFloat(validPayment.amount || 0);
                    let assignedPermissions = {};

                    // Tier-based permission logic based on payment amount
                    if (amount >= 10 && amount <= 15) {
                        assignedPermissions = { android: true, pc: true };
                    } else if (amount >= 20 && amount <= 25) {
                        assignedPermissions = { android: true, pc: true, win: true, p: true };
                    } else if (amount >= 26) {
                        assignedPermissions = { ana: true, android: true, lb: true, p: true, pc: true, t: true, win: true };
                    } else {
                        assignedPermissions = { android: true, pc: true }; // Default minimum tier
                    }

                    return res.status(200).json({ 
                        status: "verified", 
                        authorized: true, 
                        permissions: assignedPermissions,
                        message: "Payment verified successfully!" 
                    });
                }
            }
        }

        return res.status(200).json({ status: "locked", authorized: false });

    } catch (error) {
        console.error("Payment API Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
