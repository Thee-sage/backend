import mongoose from 'mongoose';

const adminActionSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const adSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    link: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        required: true
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

// Add indexes for better query performance
adSchema.index({ location: 1 });
adSchema.index({ 'createdBy.email': 1 });
adSchema.index({ 'lastEditedBy.email': 1 });

// Add method to check if document is new
adSchema.methods.isNew = function() {
    return this._id === undefined;
};

export const Ad = mongoose.model('Ad', adSchema);