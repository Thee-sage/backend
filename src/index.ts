import express from "express";
import { outcomes } from "./outcomes";
import cors from "cors";
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './auth';
import walletRequestRoutes from './walletRequest';
import adsRoutes from './ads';
import demoRoutes from './demo';
import accountRoutes from './account';
import adminRoutes from "./admin";
import http from 'http';
import { Server as SocketIOServer } from "socket.io";
import { GameSettings, IGameSettings } from './models/GameSettings';
import { User, Wallet } from "./models";
import publicadsRoutes from "./publicads";
import path from 'path';
import multer from 'multer';
import fs from 'fs';
dotenv.config();

const app = express();
const server = http.createServer(app);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});

const fileFilter = (req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return cb(new Error('Only image files are allowed!'));
    }
    cb(null, true);
};

export const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: fileFilter
});

// Define allowed origins
const allowedOrigins = [
    "https://frontend-nu-blond-80.vercel.app",
    "http://localhost:5173",
    "https://plinkochallenge.com/"
];

// Configure CORS for Express
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    optionsSuccessStatus: 200,
    exposedHeaders: ['Content-Length', 'Content-Type'] 
}));

// Configure Socket.IO with CORS
const io = new SocketIOServer(server, {
    pingTimeout: 60000,
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["content-type"]
    },
    allowEIO3: true,
    connectTimeout: 45000,
    transports: ['websocket', 'polling']
});

// Type declarations
declare global {
    namespace Express {
        interface Request {
            io?: SocketIOServer;
            admin?: {
                uid: string;
                email: string;
                role: string;
            };
        }
    }
}

// Middleware setup
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    req.io = io;
    next();
});

// Constants
const TOTAL_DROPS = 16;
const DEFAULT_BALL_PRICE = 1;
const MULTIPLIERS: { [key: number]: number } = {
    0: 16, 1: 9, 2: 2, 3: 1.4, 4: 1.4, 5: 1.2, 6: 1.1, 7: 1,
    8: 0.5, 9: 1, 10: 1.1, 11: 1.2, 12: 1.4, 13: 1.4, 14: 2, 15: 9, 16: 16
};

const userBallDrops: { [userId: string]: { count: number, timestamp: number } } = {};

// Helper functions
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
// Socket.IO connection handling
io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    socket.on("play_game", async (data) => {
        try {
            socket.emit("game_result", { success: true });
        } catch (error) {
            socket.emit("error", { message: "Game error occurred" });
        }
    });

    socket.on("error", (error) => {
        console.error("Socket error:", error);
    });

    socket.on("disconnect", (reason) => {
        console.log("Client disconnected:", socket.id, "Reason:", reason);
    });

    socket.on("ping", () => {
        socket.emit("pong");
    });
});

// Socket.IO error handling
io.engine.on("connection_error", (err) => {
    console.log('Socket.IO connection error:', err);
});

// Routes
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

        io.emit("game_played", {
            uid: wallet.uid,
            point: points,
            pattern,
            multiplier
        });

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
        res.status(500).send({ error: (error as Error).message || "Server error" });
    }
});

app.get('/settings', async (req, res) => {
    try {
        const settings = await getGameSettings();
        res.send(settings);
    } catch (error) {
        console.error('Error fetching game settings:', error);
        res.status(500).send({ error: (error as Error).message || "Error fetching game settings." });
    }
});

app.post('/settings', async (req, res) => {
    const { 
        ballLimit, 
        initialBalance, 
        maxBallPrice, 
        dropResetTime, 
        totalCycleTime, // New parameter
        lastSignedInBy 
    } = req.body;

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
                totalCycleTime: totalCycleTime || 600000, // Default 10 minutes
                lastSignedInBy
            });
        } else {
            settings.ballLimit = ballLimit || settings.ballLimit;
            settings.initialBalance = initialBalance || settings.initialBalance;
            settings.maxBallPrice = maxBallPrice || settings.maxBallPrice;
            settings.dropResetTime = dropResetTime || settings.dropResetTime;
            settings.totalCycleTime = totalCycleTime || settings.totalCycleTime;
            settings.lastSignedInBy = lastSignedInBy;
        }

        await settings.save();

        io.emit("settings_updated", settings);

        res.json({
            message: "Settings updated successfully",
            settings
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({
            error: (error as Error).message || "Error updating game settings",
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
        res.status(500).json({ error: (error as Error).message || "Server error" });
    }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size is too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
});

// Route setup
app.use('/wallet', walletRequestRoutes);
app.use('/api/auth', authRoutes); 
app.use('/ads', adsRoutes);
app.use("/", demoRoutes);
app.use('/account', accountRoutes);
app.use('/admin', adminRoutes);
app.use('/public', publicadsRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


// MongoDB connection and server startup
if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in the environment variables.');
}
const port = process.env.PORT || 3001;
console.log('Environment variables:', {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    defaultPort: 3001
});
console.log('Final port being used:', port);

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('MongoDB connected');
        
        server.listen({
            port: parseInt(port.toString()), // Explicitly parse port to number
            host: '0.0.0.0'
        }, () => {
            console.log(`Server is running on port ${port}`);
        });
    })

// Handle process termination
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing server...');
    server.close(() => {
        console.log('Server closed');
        mongoose.connection.close()
            .then(() => {
                console.log('MongoDB connection closed');
                process.exit(0);
            })
            .catch((err) => {
                console.error('Error closing MongoDB connection:', err);
                process.exit(1);
            });
    });
});