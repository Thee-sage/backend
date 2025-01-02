"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processCasinoUpdateData = exports.cleanArrayData = exports.ensureNumericValue = void 0;
// Ensure numeric values
const ensureNumericValue = (value, defaultValue = 0) => {
    const parsed = Number(value);
    return !isNaN(parsed) && parsed >= 0 ? parsed : defaultValue;
};
exports.ensureNumericValue = ensureNumericValue;
// Clean array data
const cleanArrayData = (data) => {
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        }
        catch (_a) {
            return [];
        }
    }
    if (Array.isArray(data)) {
        return data.filter(Boolean);
    }
    return [];
};
exports.cleanArrayData = cleanArrayData;
const cleanPaymentMethods = (data) => {
    if (typeof data === 'string') {
        try {
            return JSON.parse(data);
        }
        catch (_a) {
            return [];
        }
    }
    if (Array.isArray(data)) {
        return data.map(method => ({
            name: method.name || '',
            processingTime: method.processingTime || '',
            minDeposit: Number(method.minDeposit) || 0,
            maxWithdrawal: Number(method.maxWithdrawal) || 0,
            fees: method.fees || ''
        }));
    }
    return [];
};
const processCasinoUpdateData = (newData, existingCasino) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    // Process payout ratio
    const payoutRatio = {
        percentage: (0, exports.ensureNumericValue)((_a = newData.payoutRatio) === null || _a === void 0 ? void 0 : _a.percentage, existingCasino.payoutRatio.percentage),
        lastUpdated: new Date()
    };
    // Process payout speed
    const payoutSpeed = {
        averageDays: ((_b = newData.payoutSpeed) === null || _b === void 0 ? void 0 : _b.averageDays) || existingCasino.payoutSpeed.averageDays,
        details: ((_c = newData.payoutSpeed) === null || _c === void 0 ? void 0 : _c.details) || existingCasino.payoutSpeed.details
    };
    // Handle categoryRatings
    let categoryRatings = [];
    try {
        if (typeof newData.categoryRatings === 'string') {
            categoryRatings = JSON.parse(newData.categoryRatings);
        }
        else if (Array.isArray(newData.categoryRatings)) {
            categoryRatings = newData.categoryRatings;
        }
        else {
            categoryRatings = existingCasino.categoryRatings;
        }
    }
    catch (_u) {
        categoryRatings = existingCasino.categoryRatings;
    }
    // Handle contentSections
    let contentSections = [];
    try {
        if (typeof newData.contentSections === 'string') {
            contentSections = JSON.parse(newData.contentSections);
        }
        else if (Array.isArray(newData.contentSections)) {
            contentSections = newData.contentSections;
        }
        else {
            contentSections = existingCasino.contentSections;
        }
    }
    catch (_v) {
        contentSections = existingCasino.contentSections;
    }
    // Handle termsAndConditions
    let termsAndConditions = {
        firstDepositBonus: {
            minDeposit: 0,
            maxCashout: 0,
            excludedPaymentMethods: [],
            wageringRequirement: 0,
            bonusExpirationDays: 0,
            processingSpeed: "Instant",
            freeSpinsConditions: {
                wageringRequirement: 0,
                maxCashout: 0,
                expirationDays: 0
            },
            bonusPercentage: 0,
            claimTimeLimit: 0,
            currencies: []
        },
        generalTerms: [],
        eligibilityRequirements: [],
        restrictedCountries: [],
        additionalNotes: []
    };
    try {
        if (typeof newData.termsAndConditions === 'string') {
            const parsed = JSON.parse(newData.termsAndConditions);
            termsAndConditions = Object.assign(Object.assign({}, termsAndConditions), parsed);
        }
        else if (typeof newData.termsAndConditions === 'object' && newData.termsAndConditions) {
            termsAndConditions = Object.assign(Object.assign({}, termsAndConditions), newData.termsAndConditions);
        }
        else {
            termsAndConditions = existingCasino.termsAndConditions;
        }
    }
    catch (_w) {
        termsAndConditions = existingCasino.termsAndConditions;
    }
    return Object.assign(Object.assign({}, newData), { payoutRatio,
        payoutSpeed, paymentMethods: cleanPaymentMethods(newData.paymentMethods) || existingCasino.paymentMethods, termsAndConditions: {
            firstDepositBonus: {
                minDeposit: (0, exports.ensureNumericValue)((_d = termsAndConditions.firstDepositBonus) === null || _d === void 0 ? void 0 : _d.minDeposit, existingCasino.termsAndConditions.firstDepositBonus.minDeposit),
                maxCashout: (0, exports.ensureNumericValue)((_e = termsAndConditions.firstDepositBonus) === null || _e === void 0 ? void 0 : _e.maxCashout, existingCasino.termsAndConditions.firstDepositBonus.maxCashout),
                excludedPaymentMethods: (0, exports.cleanArrayData)(((_f = termsAndConditions.firstDepositBonus) === null || _f === void 0 ? void 0 : _f.excludedPaymentMethods) ||
                    existingCasino.termsAndConditions.firstDepositBonus.excludedPaymentMethods),
                wageringRequirement: (0, exports.ensureNumericValue)((_g = termsAndConditions.firstDepositBonus) === null || _g === void 0 ? void 0 : _g.wageringRequirement, existingCasino.termsAndConditions.firstDepositBonus.wageringRequirement),
                bonusExpirationDays: (0, exports.ensureNumericValue)((_h = termsAndConditions.firstDepositBonus) === null || _h === void 0 ? void 0 : _h.bonusExpirationDays, existingCasino.termsAndConditions.firstDepositBonus.bonusExpirationDays),
                processingSpeed: ((_j = termsAndConditions.firstDepositBonus) === null || _j === void 0 ? void 0 : _j.processingSpeed) ||
                    existingCasino.termsAndConditions.firstDepositBonus.processingSpeed ||
                    "Instant",
                freeSpinsConditions: {
                    wageringRequirement: (0, exports.ensureNumericValue)((_l = (_k = termsAndConditions.firstDepositBonus) === null || _k === void 0 ? void 0 : _k.freeSpinsConditions) === null || _l === void 0 ? void 0 : _l.wageringRequirement, existingCasino.termsAndConditions.firstDepositBonus.freeSpinsConditions.wageringRequirement),
                    maxCashout: (0, exports.ensureNumericValue)((_o = (_m = termsAndConditions.firstDepositBonus) === null || _m === void 0 ? void 0 : _m.freeSpinsConditions) === null || _o === void 0 ? void 0 : _o.maxCashout, existingCasino.termsAndConditions.firstDepositBonus.freeSpinsConditions.maxCashout),
                    expirationDays: (0, exports.ensureNumericValue)((_q = (_p = termsAndConditions.firstDepositBonus) === null || _p === void 0 ? void 0 : _p.freeSpinsConditions) === null || _q === void 0 ? void 0 : _q.expirationDays, existingCasino.termsAndConditions.firstDepositBonus.freeSpinsConditions.expirationDays)
                },
                bonusPercentage: (0, exports.ensureNumericValue)((_r = termsAndConditions.firstDepositBonus) === null || _r === void 0 ? void 0 : _r.bonusPercentage, existingCasino.termsAndConditions.firstDepositBonus.bonusPercentage),
                claimTimeLimit: (0, exports.ensureNumericValue)((_s = termsAndConditions.firstDepositBonus) === null || _s === void 0 ? void 0 : _s.claimTimeLimit, existingCasino.termsAndConditions.firstDepositBonus.claimTimeLimit),
                currencies: (0, exports.cleanArrayData)(((_t = termsAndConditions.firstDepositBonus) === null || _t === void 0 ? void 0 : _t.currencies) ||
                    existingCasino.termsAndConditions.firstDepositBonus.currencies)
            },
            generalTerms: (0, exports.cleanArrayData)(termsAndConditions.generalTerms || existingCasino.termsAndConditions.generalTerms),
            eligibilityRequirements: (0, exports.cleanArrayData)(termsAndConditions.eligibilityRequirements || existingCasino.termsAndConditions.eligibilityRequirements),
            restrictedCountries: (0, exports.cleanArrayData)(termsAndConditions.restrictedCountries || existingCasino.termsAndConditions.restrictedCountries),
            additionalNotes: (0, exports.cleanArrayData)(termsAndConditions.additionalNotes || existingCasino.termsAndConditions.additionalNotes)
        }, categoryRatings: categoryRatings.map((rating) => (Object.assign(Object.assign({}, rating), { score: Number(parseFloat(String(rating.score || 0)).toFixed(1)) }))), contentSections: contentSections.map((section) => ({
            title: section.title || '',
            content: section.content || '',
            order: Number(section.order || 0)
        })), established: (0, exports.ensureNumericValue)(newData.established, existingCasino.established), ourRating: (0, exports.ensureNumericValue)(newData.ourRating, existingCasino.ourRating), minDeposit: (0, exports.ensureNumericValue)(newData.minDeposit, existingCasino.minDeposit), maxPayout: (0, exports.ensureNumericValue)(newData.maxPayout, existingCasino.maxPayout), advantages: (0, exports.cleanArrayData)(newData.advantages || existingCasino.advantages), disadvantages: (0, exports.cleanArrayData)(newData.disadvantages || existingCasino.disadvantages), currencies: (0, exports.cleanArrayData)(newData.currencies || existingCasino.currencies), licenses: (0, exports.cleanArrayData)(newData.licenses || existingCasino.licenses), securityMeasures: (0, exports.cleanArrayData)(newData.securityMeasures || existingCasino.securityMeasures), fairnessVerification: (0, exports.cleanArrayData)(newData.fairnessVerification || existingCasino.fairnessVerification) });
};
exports.processCasinoUpdateData = processCasinoUpdateData;
