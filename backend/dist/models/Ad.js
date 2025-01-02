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
exports.Ad = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const adminActionSchema = new mongoose_1.default.Schema({
    email: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});
const adSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    link: { type: String, required: true },
    rating: {
        type: Number,
        required: true,
        min: 0,
        max: 5,
        validate: {
            validator: function (v) {
                return !isNaN(v) && v >= 0 && v <= 5 &&
                    Number(v.toFixed(1)) === v;
            },
            message: (props) => `${props.value} is not a valid rating! Must be between 0 and 5 with at most 1 decimal place.`
        }
    },
    image: { data: Buffer, contentType: String },
    imageUrl: {
        type: String,
        default: '/default-placeholder.jpg',
        required: false
    },
    service: {
        type: String,
        enum: ['GoogleAdSense', 'Custom'],
        default: 'Custom'
    },
    location: {
        type: String,
        required: true
    },
    isShowInMainPage: {
        type: Boolean,
        default: false
    },
    percentageInHomePage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
        validate: {
            validator: function (v) {
                return __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    if (!this.isShowInMainPage || this.location !== 'MainContent') {
                        return true;
                    }
                    const Ad = mongoose_1.default.model('Ad');
                    return yield Ad.validateTotalPercentage(v, (_a = this._id) === null || _a === void 0 ? void 0 : _a.toString());
                });
            },
            message: 'Total percentage for MainContent ads cannot exceed 100%'
        }
    },
    orderInCasinosPage: {
        type: Number,
        default: 0,
        validate: {
            validator: function (v) {
                return __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    if (this.location !== 'MainContent') {
                        return true;
                    }
                    const Ad = mongoose_1.default.model('Ad');
                    return yield Ad.validateUniqueOrder(v, (_a = this._id) === null || _a === void 0 ? void 0 : _a.toString());
                });
            },
            message: 'This order number is already taken'
        }
    },
    casino: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Casino',
        required: false
    },
    createdBy: {
        type: adminActionSchema,
        required: true
    },
    lastEditedBy: {
        type: adminActionSchema,
        required: true
    }
}, {
    timestamps: true
});
// Indexes
adSchema.index({ location: 1 });
adSchema.index({ orderInCasinosPage: 1 });
adSchema.index({ 'createdBy.email': 1 });
adSchema.index({ 'lastEditedBy.email': 1 });
adSchema.index({ casino: 1 });
// Methods
adSchema.methods.isNew = function () {
    return this._id === undefined;
};
// Static methods using statics property
adSchema.statics = {
    validateTotalPercentage(newPercentage, excludeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                location: 'MainContent',
                isShowInMainPage: true
            };
            if (excludeId) {
                query._id = { $ne: new mongoose_1.default.Types.ObjectId(excludeId) };
            }
            const ads = yield this.find(query);
            const totalPercentage = ads.reduce((sum, ad) => sum + (ad.percentageInHomePage || 0), 0);
            return (totalPercentage + newPercentage) <= 100;
        });
    },
    validateUniqueOrder(order, excludeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                location: 'MainContent',
                orderInCasinosPage: order
            };
            if (excludeId) {
                query._id = { $ne: new mongoose_1.default.Types.ObjectId(excludeId) };
            }
            const existingAd = yield this.findOne(query);
            return !existingAd;
        });
    }
};
// Pre-save middleware
adSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            if (this.location === 'MainContent') {
                if (this.isShowInMainPage) {
                    const Ad = mongoose_1.default.model('Ad');
                    const isValidPercentage = yield Ad.validateTotalPercentage(this.percentageInHomePage, (_a = this._id) === null || _a === void 0 ? void 0 : _a.toString());
                    if (!isValidPercentage) {
                        throw new Error('Total percentage for MainContent ads cannot exceed 100%');
                    }
                }
                const Ad = mongoose_1.default.model('Ad');
                const isValidOrder = yield Ad.validateUniqueOrder(this.orderInCasinosPage, (_b = this._id) === null || _b === void 0 ? void 0 : _b.toString());
                if (!isValidOrder) {
                    throw new Error('This order number is already taken');
                }
            }
            if (this.casino) {
                yield mongoose_1.default.model('Casino').findByIdAndUpdate(this.casino, { $addToSet: { ads: this._id } }, { new: true });
            }
            next();
        }
        catch (error) {
            next(error);
        }
    });
});
// Pre-deleteOne middleware
adSchema.pre('deleteOne', { document: true, query: false }, function () {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.casino) {
            yield mongoose_1.default.model('Casino').findByIdAndUpdate(this.casino, { $pull: { ads: this._id } });
        }
    });
});
exports.Ad = mongoose_1.default.model('Ad', adSchema);
