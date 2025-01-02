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
exports.handleSocketDisconnect = void 0;
const express_1 = __importDefault(require("express"));
const outcomes_1 = require("./outcomes");
const demoRouter = express_1.default.Router();
const TOTAL_DROPS = 16;
const BALL_LIMIT = 10;
const MULTIPLIERS = {
    0: 16, 1: 9, 2: 2, 3: 1.4, 4: 1.4, 5: 1.2, 6: 1.1, 7: 1, 8: 0.5, 9: 1,
    10: 1.1, 11: 1.2, 12: 1.4, 13: 1.4, 14: 2, 15: 9, 16: 16
};
const userBallDrops = {};
// Base demo route check
demoRouter.get("/", (req, res) => {
    res.send("Demo API is up and running!");
});
// Update socket ID when user connects
const updateUserSocket = (userId, socketId) => {
    if (userBallDrops[userId]) {
        // If socket ID changed, reset the count (user opened in new browser/session)
        if (userBallDrops[userId].socketId !== socketId) {
            userBallDrops[userId] = {
                count: 0,
                lastPlayed: Date.now(),
                socketId
            };
        }
    }
    else {
        // New user
        userBallDrops[userId] = {
            count: 0,
            lastPlayed: Date.now(),
            socketId
        };
    }
};
// Main demo game simulation route
demoRouter.post("/demo-game", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, ballPrice, socketId } = req.body;
    if (!userId || ballPrice <= 0) {
        return res.status(400).send({ error: "User ID and valid ball price are required." });
    }
    // Update socket ID and handle session reset
    updateUserSocket(userId, socketId);
    // Check ball limit for this specific user
    if (userBallDrops[userId].count >= BALL_LIMIT) {
        return res.status(429).send({
            error: "Ball drop limit reached. Please log in to continue playing.",
            remainingBalls: 0
        });
    }
    userBallDrops[userId].count++;
    userBallDrops[userId].lastPlayed = Date.now();
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
    // If socket.io instance is available, emit the game result
    if (req.io) {
        req.io.to(socketId).emit("demo_game_result", {
            point: points,
            multiplier,
            pattern,
            remainingBalls: BALL_LIMIT - userBallDrops[userId].count
        });
    }
    res.send({
        point: points,
        multiplier,
        pattern,
        remainingBalls: BALL_LIMIT - userBallDrops[userId].count
    });
}));
// Optional: Add an endpoint to check remaining balls
demoRouter.get("/remaining-balls/:userId", (req, res) => {
    const { userId } = req.params;
    const { socketId } = req.query;
    if (socketId) {
        updateUserSocket(userId, socketId);
    }
    if (!userBallDrops[userId]) {
        res.send({ remainingBalls: BALL_LIMIT });
    }
    else {
        res.send({ remainingBalls: BALL_LIMIT - userBallDrops[userId].count });
    }
});
// Handle socket disconnection
const handleSocketDisconnect = (socketId) => {
    // Find and update any user entries with this socket ID
    Object.entries(userBallDrops).forEach(([userId, data]) => {
        if (data.socketId === socketId) {
            data.socketId = null;
        }
    });
};
exports.handleSocketDisconnect = handleSocketDisconnect;
// Export the router as default
exports.default = demoRouter;
