import express, { Request, Response } from "express";
import { outcomes } from "./outcomes";

const demoRouter = express.Router();
const TOTAL_DROPS = 16;
const BALL_LIMIT = 10;
const MULTIPLIERS: { [key: number]: number } = {
    0: 16, 1: 9, 2: 2, 3: 1.4, 4: 1.4, 5: 1.2, 6: 1.1, 7: 1, 8: 0.5, 9: 1,
    10: 1.1, 11: 1.2, 12: 1.4, 13: 1.4, 14: 2, 15: 9, 16: 16
};

// In-memory storage for user ball drop counts
const userBallDrops: { [userId: string]: { count: number } } = {};

// Base demo route check
demoRouter.get("/", (req: Request, res: Response) => {
    res.send("Demo API is up and running!");
});

// Main demo game simulation route
demoRouter.post("/demo-game", async (req: Request, res: Response) => {
    const { userId, ballPrice } = req.body;

    if (!userId || ballPrice <= 0) {
        return res.status(400).send({ error: "User ID and valid ball price are required." });
    }

    // Initialize user ball drop count if not present
    if (!userBallDrops[userId]) {
        userBallDrops[userId] = { count: 0 };
    }

    if (userBallDrops[userId].count >= BALL_LIMIT) {
        return res.status(429).send({ error: "Ball drop limit reached. Please log in to continue playing." });
    }

    userBallDrops[userId].count++;

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

    res.send({
        point: points,
        multiplier,
        pattern,
        remainingBalls: BALL_LIMIT - userBallDrops[userId].count,
    });
});

export default demoRouter;
