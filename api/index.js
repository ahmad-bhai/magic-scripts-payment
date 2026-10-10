// api/index.js (Vercel Serverless Function - Check ID & Payment Status)
import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id, txid } = req.query;
    res.setHeader('Content-Type', 'application/json');

    if (!id) {
        return res.status(400).json({ error: "id required" });
    }

    const API_KEY = process.env.BINANCE_API_KEY || "dl7afnQdUgJl8QqVD0vlN1qk9B6ECILcyPHBFhDYw1oqu3JZlJpEkmg0SGTvW28L";
    const SECRET_KEY = process.env.BINANCE_SECRET_KEY || "Obl08n7w6wO7S2OZcNajlXHBYkHRDCRYSrXnozv88VsYfAjRvdpbvTUf0eRdWVmH";

    try {
        // 1. Check main / admin DB for ID authorization
        const mainAuthAPI = "https://magic-scripts.vercel.app/api/q?id=" + id;
        const manuAuthAPI = "https://magic-scripts.vercel.app/api/admin?id=" + id;

        const [mainRes, manuRes] = await Promise.all([
            fetch(mainAuthAPI).catch(() => null),
            fetch(manuAuthAPI).catch(() => null)
        ]);

        const mainData = mainRes && mainRes.ok ? await mainRes.json() : null;
        const manuData = manuRes && manuRes.ok ? await manuRes.json() : null;

        let idApproved = false;
        let permissions = {};
        if ((mainData && mainData.authorized === true) || (manuData && manuData.authorized === true)) {
            idApproved = true;
            permissions = (mainData && mainData.permissions) || (manuData && manuData.permissions) || {};
        }

        // 2. Check Payment Status via Binance API or TxID verification
        let paymentApproved = false;

        if (txid) {
            // Optional: Agar user ne TxID submit ki hai toh verify karein
            paymentApproved = true; // Yahan aap apni custom TxID verification laga sakte hain
        }

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
                    paymentApproved = true;
                    const amount = parseFloat(validPayment.amount || 0);
                    if (amount >= 10 && amount <= 15) {
                        permissions = { android: true, pc: true };
                    } else if (amount >= 20 && amount <= 25) {
                        permissions = { android: true, pc: true, win: true, p: true };
                    } else if (amount >= 26) {
                        permissions = { ana: true, android: true, lb: true, p: true, pc: true, t: true, win: true };
                    }
                }
            }
        }

        return res.status(200).json({
            idApproved: idApproved,
            paymentApproved: paymentApproved,
            permissions: permissions
        });

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
