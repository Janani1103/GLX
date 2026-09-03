import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
        
        try {
            await mongoose.connection.db.collection('products').dropIndex('sku_1');
            console.log('✓ Successfully dropped old non-sparse sku_1 index');
        } catch (e) {
            // Index doesn't exist or already dropped
        }

        return conn;
    } catch (error) {
        console.error(`✗ MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;