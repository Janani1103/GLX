import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Models
import User from './src/models/User.js';
import Category from './src/models/Category.js';
import Brand from './src/models/Brand.js';
import UnitOfMeasure from './src/models/UnitOfMeasure.js';
import Warehouse from './src/models/Warehouse.js';
import Product from './src/models/Product.js';
import StockItem from './src/models/StockItem.js';
import Customer from './src/models/Customer.js';
import Supplier from './src/models/Supplier.js';
import Quotation from './src/models/Quotation.js';
import SalesOrder from './src/models/SalesOrder.js';
import PurchaseOrder from './src/models/PurchaseOrder.js';
import GoodsReceiptNote from './src/models/GoodsReceiptNote.js';
import Invoice from './src/models/Invoice.js';
import Bill from './src/models/Bill.js';
import Payment from './src/models/Payment.js';
import BillOfMaterials from './src/models/BillOfMaterials.js';
import ProductionOrder from './src/models/ProductionOrder.js';
import ProductionBatch from './src/models/ProductionBatch.js';
import Department from './src/models/Department.js';
import Designation from './src/models/Designation.js';
import Shift from './src/models/Shift.js';
import Employee from './src/models/Employee.js';
import Attendance from './src/models/Attendance.js';
import LeaveRequest from './src/models/LeaveRequest.js';
import PettyCash from './src/models/PettyCash.js';
import Expense from './src/models/Expense.js';
import FixedAsset from './src/models/FixedAsset.js';
import CustomerReturn from './src/models/CustomerReturn.js';
import SupplierReturn from './src/models/SupplierReturn.js';
import DamageRecord from './src/models/DamageRecord.js';
import RepairOrder from './src/models/RepairOrder.js';
import Project from './src/models/Project.js';
import { seedPermissions } from './src/utils/seedPermissions.js';

dotenv.config();

async function seedFullData() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ Connected to MongoDB');

        // 1. Seed Permissions
        console.log('\n--- 1. SEEDING PERMISSIONS ---');
        await seedPermissions();

        // 2. Seed System Users (One for each role)
        console.log('\n--- 2. SEEDING USERS ---');
        const roles = [
            { email: 'admin@glx.lk', firstName: 'System', lastName: 'Admin', role: 'admin' },
            { email: 'sales@glx.lk', firstName: 'Kamal', lastName: 'Perera', role: 'sales_manager' },
            { email: 'warehouse@glx.lk', firstName: 'Sunil', lastName: 'Fernando', role: 'warehouse_manager' },
            { email: 'hr@glx.lk', firstName: 'Nimali', lastName: 'Jayasinghe', role: 'hr_manager' },
            { email: 'accountant@glx.lk', firstName: 'Saman', lastName: 'Silva', role: 'accountant' },
            { email: 'cashier@glx.lk', firstName: 'Dilani', lastName: 'De Silva', role: 'cashier' },
            { email: 'employee@glx.lk', firstName: 'Ruwan', lastName: 'Kumara', role: 'employee' },
        ];

        const userMap = {};
        for (const u of roles) {
            let user = await User.findOne({ email: u.email });
            if (!user) {
                user = new User({
                    firstName: u.firstName,
                    lastName: u.lastName,
                    email: u.email,
                    password: 'Password123!',
                    role: u.role,
                    isActive: true,
                });
                await user.save();
                console.log(`  + Created user: ${u.email} (${u.role})`);
            } else {
                console.log(`  ✓ Existing user: ${u.email} (${u.role})`);
            }
            userMap[u.role] = user;
        }

        const adminId = userMap.admin._id;

        // 3. Seed Categories, Brands, UOMs, Warehouses
        console.log('\n--- 3. SEEDING MASTER DATA (Categories, Brands, UOM, Warehouses) ---');
        const catNames = ['Truck Bodies', 'Aluminium Profiles', 'Refrigerated Units', 'Raw Materials', 'Hardware & Fasteners'];
        const catMap = {};
        for (const name of catNames) {
            let cat = await Category.findOne({ name });
            if (!cat) {
                cat = await Category.create({ name, code: name.substring(0, 4).toUpperCase(), description: `${name} Category`, createdBy: adminId });
                console.log(`  + Created category: ${name}`);
            }
            catMap[name] = cat;
        }

        const brandNames = ['GLX Standard', 'ThermalKing', 'Dhollandia', 'Isuzu Genuine'];
        const brandMap = {};
        for (const name of brandNames) {
            let brand = await Brand.findOne({ name });
            if (!brand) {
                brand = await Brand.create({ name, description: `${name} Brand`, createdBy: adminId });
                console.log(`  + Created brand: ${name}`);
            }
            brandMap[name] = brand;
        }

        let uomPcs = await UnitOfMeasure.findOne({ $or: [{ name: 'Pieces' }, { symbol: 'pcs' }] });
        if (!uomPcs) {
            uomPcs = await UnitOfMeasure.create({ name: 'Pieces', symbol: 'pcs', type: 'quantity', isActive: true });
        }
        let uomKg = await UnitOfMeasure.findOne({ $or: [{ name: 'Kilograms' }, { symbol: 'kg' }] });
        if (!uomKg) {
            uomKg = await UnitOfMeasure.create({ name: 'Kilograms', symbol: 'kg', type: 'weight', isActive: true });
        }

        let mainWarehouse = await Warehouse.findOne({ name: 'Ja-Ela Main Factory' });
        if (!mainWarehouse) {
            mainWarehouse = await Warehouse.create({
                name: 'Ja-Ela Main Factory',
                code: 'WH-MAIN',
                address: { line1: '45/2 Negombo Road', city: 'Ja-Ela', country: 'Sri Lanka' },
                isDefault: true,
                createdBy: adminId
            });
            console.log('  + Created warehouse: Ja-Ela Main Factory');
        }

        // 4. Seed Products
        console.log('\n--- 4. SEEDING PRODUCTS ---');
        const productData = [
            {
                productCode: 'GLX-BODY-145',
                name: 'Heavy Duty Lorry Body 14.5ft',
                category: catMap['Truck Bodies']._id,
                brand: brandMap['GLX Standard']._id,
                productType: 'finished_good',
                basePrice: 1250000,
                costPrice: 950000,
                unitOfMeasure: 'pcs',
            },
            {
                productCode: 'GLX-FREEZER-10',
                name: 'Insulated Freezer Box 10ft',
                category: catMap['Refrigerated Units']._id,
                brand: brandMap['ThermalKing']._id,
                productType: 'finished_good',
                basePrice: 1850000,
                costPrice: 1400000,
                unitOfMeasure: 'pcs',
            },
            {
                productCode: 'RAW-ALU-SHEET',
                name: 'Aluminium Sheet 2mm (8x4)',
                category: catMap['Aluminium Profiles']._id,
                brand: brandMap['GLX Standard']._id,
                productType: 'raw_material',
                basePrice: 28000,
                costPrice: 22000,
                unitOfMeasure: 'pcs',
            },
            {
                productCode: 'RAW-STEEL-TUBE',
                name: 'Steel Square Tube 2x2 Inch',
                category: catMap['Raw Materials']._id,
                brand: brandMap['GLX Standard']._id,
                productType: 'raw_material',
                basePrice: 14500,
                costPrice: 11000,
                unitOfMeasure: 'pcs',
            },
            {
                productCode: 'ACC-TAILGATE-15',
                name: 'Hydraulic Tailgate Lift 1.5T',
                category: catMap['Hardware & Fasteners']._id,
                brand: brandMap['Dhollandia']._id,
                productType: 'finished_good',
                basePrice: 650000,
                costPrice: 480000,
                unitOfMeasure: 'pcs',
            }
        ];

        const productMap = {};
        for (const p of productData) {
            let prod = await Product.findOne({ productCode: p.productCode });
            if (!prod) {
                prod = await Product.create({ ...p, createdBy: adminId });
                console.log(`  + Created product: ${p.name} (${p.productCode})`);
            }
            productMap[p.productCode] = prod;

            // Ensure stock item exists
            let stock = await StockItem.findOne({ productId: prod._id, warehouseId: mainWarehouse._id });
            if (!stock) {
                await StockItem.create({
                    productId: prod._id,
                    productCode: prod.productCode,
                    productName: prod.name,
                    warehouseId: mainWarehouse._id,
                    quantities: {
                        onHand: 25,
                        openStock: 25,
                        available: 25
                    },
                    costPerUnit: prod.costPrice || 1000
                });
                console.log(`    + Created stock balance: 25 pcs for ${prod.name}`);
            }
        }

        // 5. Seed Customers & Suppliers
        console.log('\n--- 5. SEEDING CUSTOMERS & SUPPLIERS ---');
        let customer1 = await Customer.findOne({ companyName: 'Abans Logistics Pvt Ltd' });
        if (!customer1) {
            customer1 = await Customer.create({
                displayName: 'Abans Logistics',
                companyName: 'Abans Logistics Pvt Ltd',
                customerType: 'company',
                primaryContact: { name: 'Dhammika Perera', email: 'dhammika@abans.lk', phone: '+94 77 333 4444' },
                billingAddress: { line1: '498 Galle Road', city: 'Colombo 03', country: 'Sri Lanka' },
                createdBy: adminId
            });
            console.log('  + Created Customer: Abans Logistics');
        }

        let customer2 = await Customer.findOne({ companyName: 'Keells Super Distribution' });
        if (!customer2) {
            customer2 = await Customer.create({
                displayName: 'Keells Distribution',
                companyName: 'Keells Super Distribution',
                customerType: 'company',
                primaryContact: { name: 'Niroshan Dickwella', email: 'niroshan@keells.com', phone: '+94 71 888 9999' },
                billingAddress: { line1: '130 Glennie Street', city: 'Colombo 02', country: 'Sri Lanka' },
                createdBy: adminId
            });
            console.log('  + Created Customer: Keells Super Distribution');
        }

        let supplier1 = await Supplier.findOne({ $or: [{ name: 'Alumex PLC' }, { supplierCode: 'SUP-ALUMEX' }] });
        if (!supplier1) {
            supplier1 = await Supplier.create({
                name: 'Alumex PLC',
                supplierCode: 'SUP-ALUMEX',
                contactPerson: 'Pramod Fernando',
                email: 'sales@alumexgroup.com',
                phone: '+94 11 240 0000',
                createdBy: adminId
            });
            console.log('  + Created Supplier: Alumex PLC');
        }

        let supplier2 = await Supplier.findOne({ $or: [{ name: 'Lanka Steel Industries' }, { supplierCode: 'SUP-LANKASTEEL' }] });
        if (!supplier2) {
            supplier2 = await Supplier.create({
                name: 'Lanka Steel Industries',
                supplierCode: 'SUP-LANKASTEEL',
                contactPerson: 'Kusal Mendis',
                email: 'info@lankasteel.lk',
                phone: '+94 11 299 1111',
                createdBy: adminId
            });
            console.log('  + Created Supplier: Lanka Steel Industries');
        }

        // 6. Seed Quotation & Sales Order
        console.log('\n--- 6. SEEDING CRM, QUOTATIONS & SALES ORDERS ---');
        let quote = await Quotation.findOne({ quoteNumber: 'QUT-2026-001' });
        if (!quote) {
            quote = await Quotation.create({
                quoteNumber: 'QUT-2026-001',
                documentType: 'quotation',
                customerId: customer1._id,
                customerName: customer1.companyName,
                customerPhone: customer1.primaryContact.phone,
                customerEmail: customer1.primaryContact.email,
                vehicleNo: 'WP CB-8844',
                vehicleModel: 'Isuzu NPR 75',
                jobCaption: 'Complete 14.5ft Aluminium Lorry Body Fabrication',
                salesRep: 'Kamal Perera',
                status: 'accepted',
                items: [
                    {
                        product: productMap['GLX-BODY-145']._id,
                        productName: productMap['GLX-BODY-145'].name,
                        quantity: 1,
                        unitPrice: 1250000,
                        subtotal: 1250000
                    }
                ],
                totalAmount: 1250000,
                grandTotal: 1250000,
                createdBy: userMap.sales_manager._id
            });
            console.log('  + Created Quotation: QUT-2026-001');
        }

        let salesOrder = await SalesOrder.findOne({ orderNumber: 'SO-2026-001' });
        if (!salesOrder) {
            salesOrder = await SalesOrder.create({
                orderNumber: 'SO-2026-001',
                customer: customer1._id,
                quotation: quote._id,
                orderDate: new Date(),
                deliveryDate: new Date(Date.now() + 14 * 86400000),
                status: 'confirmed',
                paymentStatus: 'partially_paid',
                items: [
                    {
                        product: productMap['GLX-BODY-145']._id,
                        quantity: 1,
                        unitPrice: 1250000,
                        subtotal: 1250000
                    }
                ],
                subtotal: 1250000,
                totalAmount: 1250000,
                advancePaid: 500000,
                balanceDue: 750000,
                createdBy: userMap.sales_manager._id
            });
            console.log('  + Created Sales Order: SO-2026-001');
        }

        // 7. Seed Invoices, Bills & Payments
        console.log('\n--- 7. SEEDING INVOICES, BILLS & PAYMENTS ---');
        let invoice = await Invoice.findOne({ invoiceNumber: 'INV-2026-001' });
        if (!invoice) {
            invoice = await Invoice.create({
                invoiceNumber: 'INV-2026-001',
                customer: customer1._id,
                salesOrder: salesOrder._id,
                issueDate: new Date(),
                dueDate: new Date(Date.now() + 30 * 86400000),
                status: 'partially_paid',
                items: [
                    {
                        product: productMap['GLX-BODY-145']._id,
                        description: productMap['GLX-BODY-145'].name,
                        quantity: 1,
                        unitPrice: 1250000,
                        subtotal: 1250000
                    }
                ],
                subtotal: 1250000,
                totalAmount: 1250000,
                paidAmount: 500000,
                balanceAmount: 750000,
                createdBy: userMap.accountant._id
            });
            console.log('  + Created Invoice: INV-2026-001');
        }

        let payment = await Payment.findOne({ paymentNumber: 'PAY-2026-001' });
        if (!payment) {
            payment = await Payment.create({
                paymentNumber: 'PAY-2026-001',
                customer: customer1._id,
                invoice: invoice._id,
                amount: 500000,
                paymentDate: new Date(),
                paymentMethod: 'bank_transfer',
                referenceNumber: 'TRF-ABANS-998',
                status: 'posted',
                createdBy: userMap.cashier._id
            });
            console.log('  + Created Payment Receipt: PAY-2026-001 (LKR 500,000)');
        }

        // 8. Seed BOM & Production Order
        console.log('\n--- 8. SEEDING BOM & PRODUCTION ---');
        let bom = await BillOfMaterials.findOne({ bomNumber: 'BOM-BODY-145' });
        if (!bom) {
            bom = await BillOfMaterials.create({
                bomNumber: 'BOM-BODY-145',
                finishedProduct: productMap['GLX-BODY-145']._id,
                name: 'BOM for 14.5ft Lorry Body',
                version: '1.0',
                isActive: true,
                items: [
                    { rawMaterial: productMap['RAW-ALU-SHEET']._id, quantityRequired: 14 },
                    { rawMaterial: productMap['RAW-STEEL-TUBE']._id, quantityRequired: 20 }
                ],
                estimatedCost: 850000,
                createdBy: userMap.warehouse_manager._id
            });
            console.log('  + Created BOM: BOM-BODY-145');
        }

        let prodOrder = await ProductionOrder.findOne({ orderNumber: 'PO-PROD-2026-01' });
        if (!prodOrder) {
            prodOrder = await ProductionOrder.create({
                orderNumber: 'PO-PROD-2026-01',
                product: productMap['GLX-BODY-145']._id,
                bom: bom._id,
                salesOrder: salesOrder._id,
                quantity: 1,
                status: 'in_progress',
                startDate: new Date(),
                targetCompletionDate: new Date(Date.now() + 7 * 86400000),
                createdBy: userMap.warehouse_manager._id
            });
            console.log('  + Created Production Order: PO-PROD-2026-01');
        }

        // 9. Seed HR Data (Departments, Designations, Employees, Attendance)
        console.log('\n--- 9. SEEDING HR DATA (Departments, Designations, Employees, Attendance) ---');
        let deptEng = await Department.findOne({ name: 'Fabrication & Welding' });
        if (!deptEng) {
            deptEng = await Department.create({ name: 'Fabrication & Welding', code: 'FAB', createdBy: adminId });
            console.log('  + Created Department: Fabrication & Welding');
        }

        let desigWelder = await Designation.findOne({ $or: [{ name: 'Senior Welder' }, { code: 'WELDER-SR' }] });
        if (!desigWelder) {
            desigWelder = await Designation.create({ name: 'Senior Welder', code: 'WELDER-SR', departmentId: deptEng._id, level: 3 });
            console.log('  + Created Designation: Senior Welder');
        }

        let emp1 = await Employee.findOne({ employeeId: 'EMP-001' });
        if (!emp1) {
            emp1 = await Employee.create({
                employeeId: 'EMP-001',
                firstName: 'Ruwan',
                lastName: 'Kumara',
                nic: '199012345678',
                email: 'employee@glx.lk',
                phone: '+94 75 111 2222',
                department: deptEng._id,
                designation: desigWelder._id,
                employmentType: 'full_time',
                joiningDate: new Date('2023-01-15'),
                basicSalary: 65000,
                user: userMap.employee._id,
                createdBy: userMap.hr_manager._id
            });
            console.log('  + Created Employee: Ruwan Kumara (EMP-001)');
        }

        // Seed Attendance
        let todayStr = new Date().toISOString().split('T')[0];
        let att = await Attendance.findOne({ employee: emp1._id, dateStr: todayStr });
        if (!att) {
            await Attendance.create({
                employee: emp1._id,
                date: new Date(),
                dateStr: todayStr,
                status: 'present',
                clockIn: '08:00',
                clockOut: '17:00',
                workHours: 9,
                createdBy: userMap.hr_manager._id
            });
            console.log(`  + Created Attendance for ${emp1.firstName} on ${todayStr}`);
        }

        // 10. Seed Petty Cash & Expenses
        console.log('\n--- 10. SEEDING PETTY CASH & EXPENSES ---');
        let pc = await PettyCash.findOne({ voucherNumber: 'PC-2026-001' });
        if (!pc) {
            await PettyCash.create({
                voucherNumber: 'PC-2026-001',
                type: 'expense',
                category: 'Hardware & Supplies',
                amount: 4500,
                payee: 'Ja-Ela Hardware Store',
                description: 'Emergency M12 bolts & welding rods purchase',
                status: 'approved',
                approvedBy: userMap.accountant._id,
                createdBy: userMap.cashier._id
            });
            console.log('  + Created Petty Cash Voucher: PC-2026-001 (LKR 4,500)');
        }

        let exp = await Expense.findOne({ title: 'Factory Lease Fee' });
        if (!exp) {
            await Expense.create({
                title: 'Factory Lease Fee',
                category: 'Rent & Rates',
                amount: 150000,
                date: new Date(),
                paymentMethod: 'Bank Transfer',
                paymentStatus: 'Paid',
                createdBy: userMap.accountant._id
            });
            console.log('  + Created Expense: Factory Lease Fee (LKR 150,000)');
        }

        console.log('\n======================================================');
        console.log('🎉 FULL DUMMY DATA SEED COMPLETED SUCCESSFULLY!');
        console.log('======================================================\n');
        console.log('You can log in with any of these credentials to test:');
        console.log('  - Admin:             admin@glx.lk      / Password123!');
        console.log('  - Sales Manager:     sales@glx.lk      / Password123!');
        console.log('  - Warehouse Manager: warehouse@glx.lk  / Password123!');
        console.log('  - HR Manager:        hr@glx.lk         / Password123!');
        console.log('  - Accountant:        accountant@glx.lk / Password123!');
        console.log('  - Cashier:           cashier@glx.lk    / Password123!');
        console.log('  - Employee:          employee@glx.lk   / Password123!\n');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error seeding full dummy data:', err);
        process.exit(1);
    }
}

seedFullData();
