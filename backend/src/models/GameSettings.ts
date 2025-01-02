import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IGameSettings extends Document {
    ballLimit: number;
    initialBalance: number;
    maxBallPrice: number;
    dropResetTime: number;
    totalCycleTime: number; // New property
    lastSignedInBy: string;
}

const gameSettingsSchema: Schema = new Schema({
    ballLimit: { type: Number, default: 100 },
    initialBalance: { type: Number, default: 200 },
    maxBallPrice: { type: Number, default: 20 },
    dropResetTime: { type: Number, default: 60000 },
    totalCycleTime: { type: Number, default: 600000 }, // 10 minutes in milliseconds
    lastSignedInBy: { type: String, required: true }
}, {
    timestamps: true
});

// Ensure only one settings document exists
gameSettingsSchema.pre('save', async function(next) {
    const settings = this.constructor as Model<IGameSettings>;
    if (this.isNew) {
        const count = await settings.countDocuments();
        if (count > 0) {
            next(new Error('Only one settings document can exist'));
        }
    }
    next();
});

export const GameSettings: Model<IGameSettings> = mongoose.model<IGameSettings>('GameSettings', gameSettingsSchema);