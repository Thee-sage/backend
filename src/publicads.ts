import express from 'express';
import { Ad } from './models/Ad';

const router = express.Router();

// Get all public ads (excluding admin info)
router.get('/', async (req, res) => {
    try {
        const ads = await Ad.find({})
            .select('title description link imageUrl service location'); // Only include the fields we want

        if (!ads || ads.length === 0) {
            return res.status(404).json({ message: 'No ads found.' });
        }
        res.status(200).json(ads);
    } catch (error) {
        console.error('Error fetching public ads:', error);
        res.status(500).json({ message: 'Error fetching ads', error });
    }
});

// Get public ad by location
router.get('/location/:location', async (req, res) => {
    try {
        const ad = await Ad.findOne({ location: req.params.location })
            .select('title description link imageUrl service location');

        if (!ad) {
            return res.status(404).json({ message: 'No ad found for this location' });
        }
        res.status(200).json(ad);
    } catch (error) {
        console.error('Error fetching public ad by location:', error);
        res.status(500).json({ message: 'Error fetching ad by location', error });
    }
});

// Get public ad by ID
router.get('/:id', async (req, res) => {
    try {
        const ad = await Ad.findById(req.params.id)
            .select('title description link imageUrl service location');

        if (!ad) {
            return res.status(404).json({ message: 'Ad not found' });
        }
        res.status(200).json(ad);
    } catch (error) {
        console.error('Error fetching public ad:', error);
        res.status(500).json({ message: 'Error fetching ad', error });
    }
});

export default router;