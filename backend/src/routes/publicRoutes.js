import path from 'path';
import express from 'express';
import asyncHandler from 'express-async-handler';
import Quotation from '../models/Quotation.js';
import Invoice from '../models/Invoice.js';

const router = express.Router();

/**
 * GET /api/public/documents/:token
 * Fetch quotation/invoice details passwordless using a unique token
 */
router.get('/documents/:token', asyncHandler(async (req, res) => {
    const { token } = req.params;

    // Search Quotation
    let doc = await Quotation.findOne({ publicToken: token });
    if (doc) {
        return res.json({
            success: true,
            documentType: doc.documentType || 'quotation',
            data: doc
        });
    }

    // Search Invoice
    doc = await Invoice.findOne({ publicToken: token });
    if (doc) {
        return res.json({
            success: true,
            documentType: 'invoice',
            data: doc
        });
    }

    res.status(404);
    throw new Error('Document not found');
}));


/**
 * GET /api/public/documents/:token/download
 * Download raw PDF file passwordless
 */
router.get('/documents/:token/download', asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { backupDocumentAsPdf } = await import('../services/smsService.js');
    
    let doc = await Quotation.findOne({ publicToken: token });
    let docType = 'quotation';
    if (!doc) {
        doc = await Invoice.findOne({ publicToken: token });
        docType = 'invoice';
    }
    
    if (!doc) {
        res.status(404);
        throw new Error('Document not found');
    }
    
    const docCode = doc.quotationCode || doc.invoiceNumber || doc._id.toString();
    const filename = `${docType}_${docCode.replace(/[\\/:*?"<>|]/g, '_')}.pdf`;
    const dir = path.resolve('backend/backups/pdfs');
    const filePath = path.join(dir, filename);
    
    if (!fs.existsSync(filePath)) {
        await backupDocumentAsPdf(doc, docType);
    }
    
    res.download(filePath, filename);
}));

export default router;
