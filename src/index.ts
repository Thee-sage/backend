import express from "express";
import { outcomes } from "./outcomes";
import cors from "cors";
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './auth';
import walletRequestRoutes from './walletRequest';
import adsRoutes from './adsads';
import demoRoutes from './demo';
import accountRoutes from './account';
import adminRoutes from "./admin";
import http from 'http';
import { Server as SocketIOServer } from "socket.io";
import { GameSettings, IGameSettings } from './models/GameSettings';
import { User, Wallet } from "./models";
import publicadsRoutes from "./publicads";
import googleRoutes from "./google"
dotenv.config();

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
    "https://frontend-nu-blond-80.vercel.app", // Remove trailing slash
    "http://localhost:5173"
];

// Configure CORS for Express
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
}));

// Configure Socket.IO with CORS
const io = new SocketIOServer(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'], // Explicitly specify transports
    allowEIO3: true // Enable EIO3 (optional)
});

// Add error handling for Socket.IO
io.engine.on("connection_error", (err) => {
    console.log('Socket.IO connection error:', err);
});

// Rest of your Socket.IO connection handling
io.on("connection", (socket) => {
    console.log("A client connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

// Express error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

declare global {
    namespace Express {
        export interface Request {
            io?: SocketIOServer;
        }
    }
}

const TOTAL_DROPS = 16;
const DEFAULT_BALL_PRICE = 1;
const MULTIPLIERS: { [key: number]: number } = {
    0: 16,
    1: 9,
    2: 2,
    3: 1.4,
    4: 1.4,
    5: 1.2,
    6: 1.1,
    7: 1,
    8: 0.5,
    9: 1,
    10: 1.1,
    11: 1.2,
    12: 1.4,
    13: 1.4,
    14: 2,
    15: 9,
    16: 16
};

const userBallDrops: { [userId: string]: { count: number, timestamp: number } } = {};

const getGameSettings = async (): Promise<IGameSettings> => {
    const settings = await GameSettings.findOne();
    if (!settings) {
        return new GameSettings({ lastSignedInBy: 'system' });
    }
    return settings;
};

const resetBallDrops = (userId: string, dropResetTime: number): void => {
    if (!userBallDrops[userId] || Date.now() - userBallDrops[userId].timestamp > dropResetTime) {
        userBallDrops[userId] = { count: 0, timestamp: Date.now() };
    }
};

io.on("connection", (socket) => {
    console.log("A client connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

app.post("/game", async (req, res) => {
    const { uid, ballPrice } = req.body;

    if (!uid) {
        return res.status(400).send({ error: "User ID is required" });
    }

    try {
        const settings = await getGameSettings();

        const BALL_LIMIT = settings.ballLimit as number;
        const MAX_BALL_PRICE = settings.maxBallPrice as number;
        const DROP_RESET_TIME = settings.dropResetTime as number;

        const user = await User.findOne({ uid });
        if (!user) {
            return res.status(404).send({ error: "User not found." });
        }

        resetBallDrops(uid, DROP_RESET_TIME);

        if (userBallDrops[uid].count >= BALL_LIMIT) {
            return res.status(429).send({ error: "Ball drop limit reached. Please wait." });
        }

        let wallet = await Wallet.findOne({ uid });
        if (!wallet) {
            wallet = new Wallet({ uid, email: user.email });
            await wallet.save();
        }

        const price = Math.min(ballPrice || DEFAULT_BALL_PRICE, MAX_BALL_PRICE);

        if (wallet.balance < price) {
            return res.status(400).send({
                error: "Not enough Zixos to drop a ball. You can request more funds.",
                requestFundsLink: "/wallet/request"
            });
        }

        wallet.balance -= price;
        await wallet.save();

        let outcome = 0;
        const pattern = [];
        for (let i = 0; i < TOTAL_DROPS; i++) {
            if (Math.random() > 0.5) {
                pattern.push("R");
                outcome++;
            } else {
                pattern.push("L");
            }
        }

        const multiplier = MULTIPLIERS[outcome];
        const possibleOutcomes = outcomes[outcome];
        const points = possibleOutcomes[Math.floor(Math.random() * possibleOutcomes.length)];
        const winnings = price * multiplier;

        wallet.balance += winnings;
        await wallet.save();

        userBallDrops[uid].count++;

        res.send({
            uid: wallet.uid,
            point: points,
            ballPrice: price,
            winnings,
            multiplier,
            pattern,
            remainingZixos: wallet.balance,
            remainingBalls: BALL_LIMIT - userBallDrops[uid].count,
        });

    } catch (error) {
        console.error('Error during game play:', error);

        // Fix: Cast 'error' to 'any' for safe access to properties
        res.status(500).send({ error: (error as any).message || "Server error" });
    }
});

app.get('/settings', async (req, res) => {
    try {
        const settings = await getGameSettings();
        res.send(settings);
    } catch (error) {
        console.error('Error fetching game settings:', error);
        res.status(500).send({ error: (error as any).message || "Error fetching game settings." });
    }
});

app.post('/settings', async (req, res) => {
    const { ballLimit, initialBalance, maxBallPrice, dropResetTime, lastSignedInBy } = req.body;

    if (!lastSignedInBy) {
        return res.status(400).json({ error: "lastSignedInBy is required" });
    }

    try {
        let settings = await GameSettings.findOne();

        if (!settings) {
            settings = new GameSettings({
                ballLimit: ballLimit || 100,
                initialBalance: initialBalance || 200,
                maxBallPrice: maxBallPrice || 20,
                dropResetTime: dropResetTime || 60000,
                lastSignedInBy
            });
        } else {
            settings.ballLimit = ballLimit || settings.ballLimit;
            settings.initialBalance = initialBalance || settings.initialBalance;
            settings.maxBallPrice = maxBallPrice || settings.maxBallPrice;
            settings.dropResetTime = dropResetTime || settings.dropResetTime;
            settings.lastSignedInBy = lastSignedInBy;
        }

        await settings.save();
        res.json({
            message: "Settings updated successfully",
            settings
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({
            error: (error as any).message || "Error updating game settings",
        });
    }
});

app.get('/user-wallet', async (req, res) => {
    const { uid } = req.query;

    if (!uid) {
        return res.status(400).json({ error: "User ID is required" });
    }

    try {
        const user = await User.findOne({ uid });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const wallet = await Wallet.findOne({ uid });
        if (!wallet) {
            return res.status(404).json({ error: "Wallet not found" });
        }

        res.json({
            uid: user.uid,
            email: user.email,
            balance: wallet.balance,
        });
    } catch (error) {
        console.error('Error fetching user-wallet data:', error);
        res.status(500).json({ error: (error as any).message || "Server error" });
    }
});

app.use('/wallet', walletRequestRoutes);
app.use('/api', authRoutes);
app.use('/ads', adsRoutes);
app.use("/", demoRoutes);
app.use('/account', accountRoutes);
app.use('/admin', adminRoutes);
app.use('/public', publicadsRoutes);
app.use("/auth/google",googleRoutes)

if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in the environment variables.');
}

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('MongoDB connected');

        server.listen(3001, () => {
            console.log('Server is running on port 3001');
        });
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
    });
