"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Casino = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ratingSchema = new mongoose_1.Schema({
    score: {
        type: Number,
        required: true,
        min: 0,
        max: 5,
        validate: {
            validator: (v) => {
                return /^\d(\.\d)?$/.test(v.toString()) && v <= 5;
            },
            message: 'Rating must be between 0 and 5 with at most 1 decimal place'
        }
    },
    category: {
        type: String,
        required: true,
        enum: ['Games', 'Support', 'Banking', 'Mobile', 'User Experience']
    },
    description: String
});
const paymentMethodSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true
    },
    processingTime: {
        type: String,
        required: true
    },
    minDeposit: {
        type: Number,
        required: true,
        min: 0
    },
    maxWithdrawal: {
        type: Number,
        required: true,
        min: 0
    },
    fees: {
        type: String,
        required: true
    }
});
const contentSectionSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    order: {
        type: Number,
        required: true
    }
});
const freeSpinsConditionsSchema = new mongoose_1.Schema({
    wageringRequirement: {
        type: Number,
        required: true
    },
    maxCashout: {
        type: Number,
        required: true
    },
    expirationDays: {
        type: Number,
        required: true
    }
});
const depositBonusSchema = new mongoose_1.Schema({
    minDeposit: {
        type: Number,
        required: true
    },
    maxCashout: {
        type: Number,
        required: true
    },
    excludedPaymentMethods: [{
            type: String,
            required: true
        }],
    wageringRequirement: {
        type: Number,
        required: true
    },
    bonusExpirationDays: {
        type: Number,
        required: true
    },
    processingSpeed: {
        type: String,
        required: true
    },
    freeSpinsConditions: {
        type: freeSpinsConditionsSchema,
        required: true
    },
    bonusPercentage: {
        type: Number,
        required: true
    },
    increasedBonusPercentage: {
        type: Number
    },
    increasedBonusTimeLimit: {
        type: Number
    },
    claimTimeLimit: {
        type: Number,
        required: true
    },
    currencies: [{
            currency: {
                type: String,
                required: true
            },
            minDeposit: {
                type: Number,
                required: true
            }
        }]
});
const termsAndConditionsSchema = new mongoose_1.Schema({
    firstDepositBonus: {
        type: depositBonusSchema,
        required: true
    },
    generalTerms: [{
            type: String,
            required: true
        }],
    eligibilityRequirements: [{
            type: String,
            required: true
        }],
    restrictedCountries: [String],
    additionalNotes: [String]
});
const adminActionSchema = new mongoose_1.Schema({
    email: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});
const casinoSchema = new mongoose_1.Schema({
    // Basic Information
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    logo: {
        type: String,
        required: true
    },
    website: {
        type: String,
        required: true
    },
    established: {
        type: Number,
        required: true,
        min: 1900,
        max: new Date().getFullYear()
    },
    // Ratings
    ourRating: {
        type: Number,
        required: true,
        min: 0,
        max: 5,
        validate: {
            validator: (v) => {
                const formatted = v.toFixed(1);
                const numValue = parseFloat(formatted);
                return numValue >= 0 && numValue <= 5 &&
                    /^\d+\.\d$/.test(formatted);
            },
            message: 'Rating must be between 0 and 5 with at most 1 decimal place'
        }
    },
    trustIndex: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        required: true
    },
    categoryRatings: {
        type: [ratingSchema],
        validate: {
            validator: function (ratings) {
                if (!Array.isArray(ratings))
                    return false;
                const requiredCategories = ['Games', 'Support', 'Banking', 'Mobile', 'User Experience'];
                const providedCategories = ratings.map(rating => rating.category);
                return requiredCategories.every(category => {
                    const rating = ratings.find(r => r.category === category);
                    if (!rating)
                        return false;
                    const score = parseFloat(rating.score.toFixed(1));
                    return score >= 0 && score <= 5;
                });
            },
            message: 'All required categories must be provided with valid ratings between 0 and 5'
        }
    },
    // Terms and Conditions
    termsAndConditions: {
        type: termsAndConditionsSchema,
        required: true
    },
    // Financial Information
    payoutRatio: {
        percentage: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
            validate: {
                validator: (v) => {
                    return /^\d{1,2}(\.\d{1,2})?$/.test(v.toString());
                },
                message: 'Payout ratio must be between 0 and 100 with at most 2 decimal places'
            }
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },
    payoutSpeed: {
        averageDays: {
            type: String,
            required: true,
            validate: {
                validator: (v) => {
                    return v.trim().length > 0;
                },
                message: 'Payout speed average days cannot be empty'
            }
        },
        details: String
    },
    // Licensing & Security
    licenses: [{
            type: String,
            required: true
        }],
    securityMeasures: [String],
    fairnessVerification: [String],
    // Payment Information
    paymentMethods: [paymentMethodSchema],
    currencies: [{
            type: String,
            required: true
        }],
    minDeposit: {
        type: Number,
        required: true,
        min: 0
    },
    maxPayout: {
        type: Number,
        required: true,
        min: 0
    },
    // Content Sections
    contentSections: [contentSectionSchema],
    // Pros and Cons
    advantages: [{
            type: String
        }],
    disadvantages: [{
            type: String
        }],
    offer: {
        type: String,
        trim: true,
        default: ''
    },
    // Administrative
    isActive: {
        type: Boolean,
        default: true
    },
    orderInListing: {
        type: Number,
        required: true
    },
    createdBy: {
        type: adminActionSchema,
        required: true
    },
    lastEditedBy: {
        type: adminActionSchema,
        required: true
    },
    ads: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Ad'
        }]
}, {
    timestamps: true
});
// Indexes
casinoSchema.index({ name: 1 });
casinoSchema.index({ orderInListing: 1 });
casinoSchema.index({ 'createdBy.email': 1 });
casinoSchema.index({ 'lastEditedBy.email': 1 });
casinoSchema.index({ isActive: 1 });
// Static methods
casinoSchema.statics.validateUniqueOrder = function (order, excludeId) {
    return __awaiter(this, void 0, void 0, function* () {
        const query = { orderInListing: order };
        if (excludeId) {
            query._id = { $ne: excludeId };
        }
        const existingCasino = yield this.findOne(query);
        return !existingCasino;
    });
};
exports.Casino = mongoose_1.default.model('Casino', casinoSchema);
