"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const express_1 = __importDefault(require("express"));
const outcomes_1 = require("./outcomes");
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./auth"));
const walletRequest_1 = __importDefault(require("./walletRequest"));
const ads_1 = __importDefault(require("./ads"));
const demo_1 = __importDefault(require("./demo"));
const account_1 = __importDefault(require("./account"));
const admin_1 = __importDefault(require("./admin"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const GameSettings_1 = require("./models/GameSettings");
const models_1 = require("./models");
const publicads_1 = __importDefault(require("./publicads"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Ensure uploads directory exists
const uploadsDir = path_1.default.join(__dirname, '../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// Configure multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});
const fileFilter = (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return cb(new Error('Only image files are allowed!'));
    }
    cb(null, true);
};
exports.upload = (0, multer_1.default)({
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
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    optionsSuccessStatus: 200,
    exposedHeaders: ['Content-Length', 'Content-Type']
}));
// Configure Socket.IO with CORS
const io = new socket_io_1.Server(server, {
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
// Middleware setup
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
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
const MULTIPLIERS = {
    0: 16, 1: 9, 2: 2, 3: 1.4, 4: 1.4, 5: 1.2, 6: 1.1, 7: 1,
    8: 0.5, 9: 1, 10: 1.1, 11: 1.2, 12: 1.4, 13: 1.4, 14: 2, 15: 9, 16: 16
};
const userBallDrops = {};
// Helper functions
const getGameSettings = () => __awaiter(void 0, void 0, void 0, function* () {
    const settings = yield GameSettings_1.GameSettings.findOne();
    if (!settings) {
        return new GameSettings_1.GameSettings({ lastSignedInBy: 'system' });
    }
    return settings;
});
const resetBallDrops = (userId, dropResetTime) => {
    if (!userBallDrops[userId] || Date.now() - userBallDrops[userId].timestamp > dropResetTime) {
        userBallDrops[userId] = { count: 0, timestamp: Date.now() };
    }
};
// Socket.IO connection handling
io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);
    socket.on("play_game", (data) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            socket.emit("game_result", { success: true });
        }
        catch (error) {
            socket.emit("error", { message: "Game error occurred" });
        }
    }));
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
app.post("/game", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { uid, ballPrice } = req.body;
    if (!uid) {
        return res.status(400).send({ error: "User ID is required" });
    }
    try {
        const settings = yield getGameSettings();
        const BALL_LIMIT = settings.ballLimit;
        const MAX_BALL_PRICE = settings.maxBallPrice;
        const DROP_RESET_TIME = settings.dropResetTime;
        const user = yield models_1.User.findOne({ uid });
        if (!user) {
            return res.status(404).send({ error: "User not found." });
        }
        resetBallDrops(uid, DROP_RESET_TIME);
        if (userBallDrops[uid].count >= BALL_LIMIT) {
            return res.status(429).send({ error: "Ball drop limit reached. Please wait." });
        }
        let wallet = yield models_1.Wallet.findOne({ uid });
        if (!wallet) {
            wallet = new models_1.Wallet({ uid, email: user.email });
            yield wallet.save();
        }
        const price = Math.min(ballPrice || DEFAULT_BALL_PRICE, MAX_BALL_PRICE);
        if (wallet.balance < price) {
            return res.status(400).send({
                error: "Not enough Zixos to drop a ball. You can request more funds.",
                requestFundsLink: "/wallet/request"
            });
        }
        wallet.balance -= price;
        yield wallet.save();
        let outcome = 0;
        const pattern = [];
        for (let i = 0; i < TOTAL_DROPS; i++) {
            if (Math.random() > 0.5) {
                pattern.push("R");
                outcome++;
            }
            else {
                pattern.push("L");
            }
        }
        const multiplier = MULTIPLIERS[outcome];
        const possibleOutcomes = outcomes_1.outcomes[outcome];
        const points = possibleOutcomes[Math.floor(Math.random() * possibleOutcomes.length)];
        const winnings = price * multiplier;
        wallet.balance += winnings;
        yield wallet.save();
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
    }
    catch (error) {
        console.error('Error during game play:', error);
        res.status(500).send({ error: error.message || "Server error" });
    }
}));
app.get('/settings', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const settings = yield getGameSettings();
        res.send(settings);
    }
    catch (error) {
        console.error('Error fetching game settings:', error);
        res.status(500).send({ error: error.message || "Error fetching game settings." });
    }
}));
app.post('/settings', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { ballLimit, initialBalance, maxBallPrice, dropResetTime, totalCycleTime, // New parameter
    lastSignedInBy } = req.body;
    if (!lastSignedInBy) {
        return res.status(400).json({ error: "lastSignedInBy is required" });
    }
    try {
        let settings = yield GameSettings_1.GameSettings.findOne();
        if (!settings) {
            settings = new GameSettings_1.GameSettings({
                ballLimit: ballLimit || 100,
                initialBalance: initialBalance || 200,
                maxBallPrice: maxBallPrice || 20,
                dropResetTime: dropResetTime || 60000,
                totalCycleTime: totalCycleTime || 600000, // Default 10 minutes
                lastSignedInBy
            });
        }
        else {
            settings.ballLimit = ballLimit || settings.ballLimit;
            settings.initialBalance = initialBalance || settings.initialBalance;
            settings.maxBallPrice = maxBallPrice || settings.maxBallPrice;
            settings.dropResetTime = dropResetTime || settings.dropResetTime;
            settings.totalCycleTime = totalCycleTime || settings.totalCycleTime;
            settings.lastSignedInBy = lastSignedInBy;
        }
        yield settings.save();
        io.emit("settings_updated", settings);
        res.json({
            message: "Settings updated successfully",
            settings
        });
    }
    catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({
            error: error.message || "Error updating game settings",
        });
    }
}));
app.get('/user-wallet', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { uid } = req.query;
    if (!uid) {
        return res.status(400).json({ error: "User ID is required" });
    }
    try {
        const user = yield models_1.User.findOne({ uid });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const wallet = yield models_1.Wallet.findOne({ uid });
        if (!wallet) {
            return res.status(404).json({ error: "Wallet not found" });
        }
        res.json({
            uid: user.uid,
            email: user.email,
            balance: wallet.balance,
        });
    }
    catch (error) {
        console.error('Error fetching user-wallet data:', error);
        res.status(500).json({ error: error.message || "Server error" });
    }
}));
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    if (err instanceof multer_1.default.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size is too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
});
// Route setup
app.use('/wallet', walletRequest_1.default);
app.use('/api/auth', auth_1.default);
app.use('/ads', ads_1.default);
app.use("/", demo_1.default);
app.use('/account', account_1.default);
app.use('/admin', admin_1.default);
app.use('/public', publicads_1.default);
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// MongoDB connection and server startup
if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in the environment variables.');
}
const port = process.env.PORT || 3001;
console.log('Final port being used:', port);
mongoose_1.default.connect(process.env.MONGODB_URI)
    .then(() => __awaiter(void 0, void 0, void 0, function* () {
    console.log('MongoDB connected');
    server.listen({
        port: parseInt(port.toString()), // Explicitly parse port to number
        host: '0.0.0.0'
    }, () => {
        console.log(`Server is running on port ${port}`);
    });
}));
// Handle process termination
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing server...');
    server.close(() => {
        console.log('Server closed');
        mongoose_1.default.connection.close()
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
